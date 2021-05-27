import ManagedLocation from "ManagedLocation";
import { RENEW_THRESHOLD } from "screeps.constants";
import XPARTS from "utils/XPARTS";

export default class Outpost extends ManagedLocation {
  public static readonly roleAttendant = "attendant";
  public static readonly attendantMax = 1;
  public name: string;
  public range: number;
  public base: RoomPosition;
  public spawn: StructureSpawn | undefined;
  public containers: StructureContainer[] = [];
  public ramparts: StructureRampart[] = [];
  public towers: StructureTower[] = [];
  public attendants: Creep[] = [];
  private spawnName: string | undefined;
  private containerIds: Id<StructureContainer>[];
  private rampartIds: Id<StructureRampart>[];
  private towerIds: Id<StructureTower>[];
  private attendantNames: string[];

  public get memory(): OutpostMemory {
    return Memory.outposts[this.base.roomName].outposts.find(
      m => m.name === this.name
    ) as OutpostMemory;
  }

  public static createMemory(flag: Flag, range: number): OutpostMemory {
    const name = flag.name;
    const base = flag.pos;

    const spawn = base.findInRange(FIND_MY_SPAWNS, range).shift();

    const containerIds = Outpost.getIdsForObjectsInRange<StructureContainer>(
      base,
      range,
      STRUCTURE_CONTAINER
    );

    const rampartIds = Outpost.getIdsForObjectsInRange<StructureRampart>(
      base,
      range,
      STRUCTURE_RAMPART
    );

    const towerIds = Outpost.getIdsForObjectsInRange<StructureTower>(
      base,
      range,
      STRUCTURE_TOWER
    );

    const attendantNames = base
      .findInRange(FIND_MY_CREEPS, range, {
        filter: (creep: Creep) => creep.memory.role === Outpost.roleAttendant
      })
      .map(creep => creep.name);

    const memory: OutpostMemory = {
      name,
      range,
      base,
      spawnName: spawn ? spawn.name : undefined,
      containerIds,
      rampartIds,
      towerIds,
      attendantNames
    };

    return memory;
  }

  public static getInstance(mem: OutpostMemory): Outpost {
    return new Outpost(mem);
  }

  public constructor(mem: OutpostMemory) {
    super();
    this.name = mem.name;
    this.range = mem.range;
    this.spawnName = mem.spawnName;
    this.base = new RoomPosition(mem.base.x, mem.base.y, mem.base.roomName);

    this.containerIds = mem.containerIds || [];
    this.rampartIds = mem.rampartIds || [];
    this.towerIds = mem.towerIds || [];
    this.attendantNames = mem.attendantNames || [];

    if (this.spawnName && Game.spawns[this.spawnName]) {
      this.spawn = Game.spawns[this.spawnName];
    }

    // Get all game objects with matching ids
    Outpost.fillWithGameObjects(this.containers, this.containerIds);
    Outpost.fillWithGameObjects(this.ramparts, this.rampartIds);
    Outpost.fillWithGameObjects(this.towers, this.towerIds);

    // Clear dead names
    this.memory.attendantNames = this.attendantNames.filter(
      name => name in Game.creeps
    );
    this.attendantNames = this.memory.attendantNames;
    this.attendants = this.attendantNames.map(name => Game.creeps[name]);
  }

  public run(): void {
    this.rescan();

    // Do we have attendants?
    if (this.attendants.length < Outpost.attendantMax) {
      if (this.spawn && !this.spawn.spawning) {
        const parts = XPARTS([CARRY, 2], [WORK, 1], [MOVE, 4]);
        const name = `${Outpost.roleAttendant}${Game.time}`;
        const res = this.spawn.spawnCreep(parts, name, {
          memory: { role: Outpost.roleAttendant }
        });
        if (res === OK) {
          this.memory.attendantNames.push(name);
        }
      }
    }

    // Direct attendants
    this.attendants
      .filter(a => !a.spawning)
      .forEach(attendant => {
        if (attendant.ticksToLive && attendant.ticksToLive < RENEW_THRESHOLD) {
          attendant.memory.renewing = true;
        }

        // Renew until full
        if (attendant.memory.renewing && this.spawn) {
          const res = this.spawn.renewCreep(attendant);
          switch (res) {
            case ERR_NOT_IN_RANGE:
              attendant.moveTo(this.spawn);
              break;
            case ERR_FULL:
              attendant.memory.renewing = false;
              break;
          }
          return;
        }

        // No energy. Grab energy from container.
        if (attendant.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          const container = this.containers.find(c => c.store[RESOURCE_ENERGY]);
          if (container) {
            const res = attendant.withdraw(container, RESOURCE_ENERGY);
            if (res === ERR_NOT_IN_RANGE) {
              attendant.moveTo(container);
            }
          }
        } else {
          // Fill towers
          const tower = this.towers
            .filter(t => t.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
            .shift();

          if (tower) {
            if (
              attendant.transfer(tower, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE
            ) {
              attendant.moveTo(tower);
            }
            return;
          }

          // Repair ramparts
          const rampart = this.ramparts.sort((a, b) => a.hits - b.hits).shift();
          if (rampart) {
            if (attendant.repair(rampart) === ERR_NOT_IN_RANGE) {
              attendant.moveTo(rampart);
            }
            return;
          }
        }
      });

    // Direct towers
    const hostiles = this.base.findInRange(FIND_HOSTILE_CREEPS, this.range);
    if (hostiles.length) {
      const target = hostiles.sort((a, b) => a.hits - b.hits).shift();
      if (target) this.towers.forEach(t => t.attack(target));
    } else {
      // TODO: heal friendlies
      // TODO: repair structures
      // Repair ramparts
      const outpostEnergyCapacity = this.containers
        .map(c => c.store.getCapacity())
        .reduce((acc, val) => (acc += val));
      const availableEnergy = this.containers
        .map(c => c.store[RESOURCE_ENERGY])
        .reduce((acc, val) => (acc += val));
      const conserve = availableEnergy < outpostEnergyCapacity * 0.5;
      if (!conserve) {
        const rampart = this.ramparts.sort((a, b) => a.hits - b.hits).shift();
        if (rampart) this.towers.forEach(t => t.repair(rampart));
      }
    }
  }

  public rescan(): void {
    // Scan for spawn
    if (!this.spawn) {
      const spawn = this.base.findInRange(FIND_MY_SPAWNS, this.range).shift();
      if (spawn) {
        this.memory.spawnName = spawn.name;
        this.spawnName = spawn.name;
        this.spawn = spawn;
      } else {
        // hijack first available spawn
        const closest = this.base.findClosestByRange(FIND_MY_SPAWNS);
        if (closest) {
          this.memory.spawnName = closest.name;
          this.spawnName = closest.name;
          this.spawn = closest;
        }
      }
    }

    // Scan for a container if we don't have at least one
    if (this.containerIds.length < 1) {
      this.containerIds = Outpost.getIdsForObjectsInRange<StructureContainer>(
        this.base,
        this.range,
        STRUCTURE_CONTAINER
      );
      this.memory.containerIds = this.containerIds;
      Outpost.fillWithGameObjects(this.containers, this.containerIds);
    }

    // Always scan for updated ramparts
    this.rampartIds = Outpost.getIdsForObjectsInRange<StructureRampart>(
      this.base,
      this.range,
      STRUCTURE_RAMPART
    );
    this.memory.rampartIds = this.rampartIds;
    Outpost.fillWithGameObjects(this.ramparts, this.rampartIds);

    // Scan for a tower if we don't have at least one
    if (this.towerIds.length < 1) {
      this.towerIds = Outpost.getIdsForObjectsInRange<StructureTower>(
        this.base,
        this.range,
        STRUCTURE_TOWER
      );
      this.memory.towerIds = this.towerIds;
      Outpost.fillWithGameObjects(this.towers, this.towerIds);
    }
  }

  public requestResources(): ResourceRequest[] {
    const requests: ResourceRequest[] = [];

    // Request energy base on container level
    for (const container of this.containers) {
      const max = container.store.getCapacity();
      const used = container.store.getUsedCapacity(RESOURCE_ENERGY);
      console.log(`Amount: ${used}, Max: ${max}`);
      if (used < max * 0.5) {
        requests.push({
          bucketId: container.id,
          type: RESOURCE_ENERGY,
          amount: max - used
        });
      }
    }
    return requests;
  }
}
