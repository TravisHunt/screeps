import ManagedStation from "./ManagedStation";
import MaintenanceService from "services/MaintenanceService";
import { RENEW_THRESHOLD } from "screeps.constants";
import { PATH_COLOR_HARVEST, PATH_COLOR_REPAIR } from "palette";

export default class ManagedSource extends ManagedStation<Source> {
  public readonly maintenanceCrewMax = 1;
  private maintenanceService: MaintenanceService;

  public constructor(memory: ManagedStationMemory<Source>) {
    super(memory);

    // Pull in the maintenance service singleton
    this.maintenanceService = MaintenanceService.getInstance();
  }

  public get source(): Source {
    return this.station;
  }

  public run(): StationInsights {
    // Clean up occupied positions
    const [done, dead] = this.clean();

    // Capture any spawning creep that belongs to this source
    if (this.maintenanceCrew.length < this.maintenanceCrewMax) {
      this.scanForSpawningPersonnel();
    }

    // Request maintenance crew if lacking
    if (this.maintenanceCrew.length < this.maintenanceCrewMax) {
      this.requestPersonnel();
    }

    // Drive maintainers
    if (this.maintenanceCrew.length) {
      this.runMaintenanceCrew();
    }

    // Run jobs and manage occupied positions
    this.runOccupants();

    // Save current personnel list
    this.memory.maintenanceCrewNames = this.maintenanceCrew.map(c => c.name);

    return {
      cleanUp: { done, dead }
    };
  }

  public findExpansionPositions(): RoomPosition[] {
    const terrain = this.source.room.getTerrain();
    const untracked = this.getUntrackedPositions();
    const viable: RoomPosition[] = [];

    // Scan terrain around each untracked position to determine if
    // building a road on the position would make it walkable.
    for (const pos of untracked) {
      const hasRoad = pos
        .lookFor(LOOK_STRUCTURES)
        .filter(s => s.structureType === STRUCTURE_ROAD).length;

      // If a build request for a road here was completed, or something messed
      // up and this position wasn't tracked, make sure we track it moving
      // forward.
      if (hasRoad) {
        this.positions.push({ x: pos.x, y: pos.y });
        continue;
      }

      const adjacent = ManagedSource.getAdjacentPositions(
        pos,
        this.room.name,
        false
      );

      for (const adj of adjacent) {
        const code = terrain.get(adj.x, adj.y);
        const validTerrain =
          (code & TERRAIN_MASK_WALL) === 0 && (code & TERRAIN_MASK_LAVA) === 0;

        const adjIsTracked = this.positions.filter(
          p => p.x === adj.x && p.y === adj.y
        ).length;

        // We avoid adding this position if the only adjacent walkable tile
        // is already tracked to avoid walking collision.
        // TODO: Implement anti-collision access to tucked positions?
        if (validTerrain && !adjIsTracked) {
          viable.push(pos);
          break;
        }
      }
    }

    return viable;
  }

  private getUntrackedPositions(): RoomPosition[] {
    const adjacent = ManagedSource.getAdjacentPositions(
      this.source.pos,
      this.room.name
    );
    const tracked = this.positions.map(
      p => new RoomPosition(p.x, p.y, this.room.name)
    );

    const untracked = adjacent.filter(adj => {
      let isUntracked = true;
      for (const t of tracked) {
        if (t.isEqualTo(adj)) {
          isUntracked = false;
          break;
        }
      }
      return isUntracked;
    });

    return untracked;
  }

  private clean(): [number, number] {
    let corpseCount = 0;
    let finishedCount = 0;

    this._positions.forEach(pos => {
      if (pos.occuiped) {
        const creep = Game.getObjectById(pos.occuiped.creepId);
        if (creep) {
          // Check harvest job progress. If we're done, clear out the slot
          // so it can be reassigned.
          pos.occuiped.progress =
            creep.store.getUsedCapacity(RESOURCE_ENERGY) - pos.occuiped.start;

          if (pos.occuiped.progress >= pos.occuiped.requested) {
            // Harvest job is done. Clear out position.
            pos.occuiped = undefined;
            finishedCount++;
          }
        } else {
          pos.occuiped = undefined;
          corpseCount++;
        }
      }
    });

    return [finishedCount, corpseCount];
  }

  private scanForSpawningPersonnel(): void {
    const spawns = this.room.find(FIND_MY_SPAWNS);
    for (const spawn of spawns) {
      if (!spawn.spawning) continue;
      const creep = Game.creeps[spawn.spawning.name];
      if (creep.memory.ownerTag === this.source.id) {
        this.maintenanceCrew.push(creep);
      }
    }
  }

  private requestPersonnel(): void {
    const res = this.maintenanceService.submitPersonnelRequest(
      this.room.name,
      this.source.id
    );

    // Log error response
    if (res !== OK) {
      // console.log(
      //   `ManagedSource (${this.source.id}) maintenance request error:`,
      //   res.message
      // );
    }
  }

  private runMaintenanceCrew(): void {
    const availableCrew = this.maintenanceCrew.filter(c => !c.spawning);
    if (!availableCrew.length) return;

    const roads = this.positionRoads
      .filter(r => r.hits < r.hitsMax)
      .sort((a, b) => a.hits - b.hits);

    if (!roads.length) return;
    const road = roads[0];

    for (const creep of availableCrew) {
      // Harvest if you have no more energy
      if (
        !creep.memory.harvesting &&
        creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0
      ) {
        // Should I renew?
        if (creep.ticksToLive && creep.ticksToLive < RENEW_THRESHOLD) {
          creep.memory.renewing = true;
        }

        // Renew until full
        if (creep.memory.renewing) {
          const spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);

          if (!spawn) {
            creep.say("Guess I'll Die");
            creep.memory.renewing = false;
          } else {
            const res = spawn.renewCreep(creep);

            switch (res) {
              case ERR_NOT_IN_RANGE:
                creep.moveTo(spawn);
                break;
              case ERR_FULL:
                creep.memory.renewing = false;
                break;
            }

            // Continue so we continue renewing until full
            continue;
          }
        }

        creep.memory.harvesting = true;
        creep.say("🔄 harvest");
      }

      // Repair if you're at carrying capacity
      if (
        creep.memory.harvesting &&
        creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
      ) {
        creep.memory.harvesting = false;
        creep.say("🚧 repair");
      }

      // TODO: use ResourceService to get energy
      if (creep.memory.harvesting) {
        if (this.room.storage) {
          if (
            creep.withdraw(this.room.storage, RESOURCE_ENERGY) ===
            ERR_NOT_IN_RANGE
          ) {
            creep.moveTo(this.room.storage, {
              visualizePathStyle: { stroke: PATH_COLOR_HARVEST }
            });
          }
        }
      } else {
        if (creep.repair(road) === ERR_NOT_IN_RANGE) {
          creep.moveTo(road, {
            visualizePathStyle: { stroke: PATH_COLOR_REPAIR }
          });
        }
      }
    }
  }

  private runOccupants(): void {
    for (const pos of this.occupiedPositions) {
      const creep = Game.getObjectById(pos.occuiped.creepId);
      if (!creep) continue;

      // Has the creep made it to their assigned harvest position?
      if (creep.pos.isEqualTo(pos.x, pos.y)) {
        // Continue harvesting for this tick
        creep.harvest(this.source);
      } else {
        // Move to the harvest position using the serialized path string
        // generated when the harvest position was assigned.
        // switch (creep.moveByPath(pos.occuiped.path)) {
        switch (creep.moveTo(pos.x, pos.y)) {
          case ERR_TIRED:
            creep.say(`Fatigued: ${creep.fatigue}`);
            break;
          case ERR_NO_BODYPART:
            creep.say("No MOVE parts!");
            break;
          // case ERR_NOT_FOUND:
          // case ERR_INVALID_ARGS:
          //   // Fall back to using moveTo to reach harvest position
          //   // to avoid stalling out.
          //   creep.say("BAD PATH");
          //   creep.moveTo(pos.x, pos.y);
        }
      }
    }
  }
}
