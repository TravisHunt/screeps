import ManagedLocation from "ManagedLocation";
import { RENEW_THRESHOLD, USERNAME } from "screeps.constants";
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
  public walls: StructureWall[] = [];
  public attendants: Creep[] = [];
  public constructionSites: ConstructionSite[] = [];
  public perimeter: Perimeter;
  private memory: OutpostMemory;
  private spawnName: string | undefined;
  private containerIds: Id<StructureContainer>[];
  private rampartIds: Id<StructureRampart>[];
  private towerIds: Id<StructureTower>[];
  private wallIds: Id<StructureWall>[];
  private attendantNames: string[];
  private constructionSiteIds: Id<
    ConstructionSite<BuildableStructureConstant>
  >[];

  public static createMemory(
    flag: Flag,
    range: number,
    perimeter?: Perimeter
  ): OutpostMemory {
    const name = flag.name;
    const base = flag.pos;

    // If no perimeter is provided, create one using the provided range.
    perimeter = perimeter || {
      x: { min: base.x - range, max: base.x + range },
      y: { min: base.y - range, max: base.y - range }
    };

    const spawn = base.findInRange(FIND_MY_SPAWNS, range).shift();
    const structures = Outpost.lookWithinPerimeter(
      LOOK_STRUCTURES,
      base.roomName,
      perimeter
    ).map(x => x.structure);

    const containerIds = structures
      .filter(s => s.structureType === STRUCTURE_CONTAINER)
      .map(c => c.id as Id<StructureContainer>);

    const rampartIds = structures
      .filter(s => s.structureType === STRUCTURE_RAMPART)
      .map(r => r.id as Id<StructureRampart>);

    const towerIds = structures
      .filter(s => s.structureType === STRUCTURE_TOWER)
      .map(t => t.id as Id<StructureTower>);

    const wallIds = structures
      .filter(s => s.structureType === STRUCTURE_WALL)
      .map(t => t.id as Id<StructureWall>);

    const constructionSiteIds = Outpost.lookWithinPerimeter(
      LOOK_CONSTRUCTION_SITES,
      base.roomName,
      perimeter
    ).map(site => site.constructionSite.id);

    // TODO: Find attendents within perimeter
    const attendantNames = base
      .findInRange(FIND_MY_CREEPS, range, {
        filter: (creep: Creep) => creep.memory.role === Outpost.roleAttendant
      })
      .map(creep => creep.name);

    const memory: OutpostMemory = {
      name,
      range,
      perimeter,
      base,
      spawnName: spawn ? spawn.name : undefined,
      containerIds,
      rampartIds,
      towerIds,
      wallIds,
      attendantNames,
      constructionSiteIds
    };

    return memory;
  }

  public static getInstance(mem: OutpostMemory): Outpost {
    return new Outpost(mem);
  }

  public constructor(mem: OutpostMemory) {
    super();
    this.memory = mem;
    this.name = mem.name;
    this.range = mem.range;
    this.spawnName = mem.spawnName;
    this.perimeter = mem.perimeter;
    this.base = new RoomPosition(mem.base.x, mem.base.y, mem.base.roomName);

    this.containerIds = mem.containerIds || [];
    this.rampartIds = mem.rampartIds || [];
    this.towerIds = mem.towerIds || [];
    this.wallIds = mem.wallIds || [];
    this.constructionSiteIds = mem.constructionSiteIds || [];
    this.attendantNames = mem.attendantNames || [];

    if (this.spawnName && Game.spawns[this.spawnName]) {
      this.spawn = Game.spawns[this.spawnName];
    }

    // Get all game objects with matching ids
    Outpost.fillWithGameObjects(this.containers, this.containerIds);
    Outpost.fillWithGameObjects(this.ramparts, this.rampartIds);
    Outpost.fillWithGameObjects(this.towers, this.towerIds);
    Outpost.fillWithGameObjects(this.walls, this.wallIds);
    Outpost.fillWithGameObjects(
      this.constructionSites,
      this.constructionSiteIds
    );

    // Clear dead ids
    // TODO: Should the outpost track positions of these objects so that
    // it can schedule rebuilds?
    this.memory.containerIds = this.containers.map(c => c.id);
    this.memory.rampartIds = this.ramparts.map(r => r.id);
    this.memory.towerIds = this.towers.map(t => t.id);
    this.memory.wallIds = this.walls.map(w => w.id);

    // Clear dead names
    this.memory.attendantNames = this.attendantNames.filter(
      name => name in Game.creeps
    );
    this.attendantNames = this.memory.attendantNames;
    this.attendants = this.attendantNames.map(name => Game.creeps[name]);
  }

  private getAdjacentPositions(
    pos: RoomPosition,
    roomName: string,
    diagonals = true
  ): RoomPosition[] {
    const positions: RoomPosition[] = [];

    if (diagonals) {
      // Scan bordering spaces for occupiable positions
      for (let x = pos.x - 1; x <= pos.x + 1; x++) {
        for (let y = pos.y - 1; y <= pos.y + 1; y++) {
          // stations aren't walkable, so skip
          if (x === pos.x && y === pos.y) continue;
          // Don't include positions outside the bounds of the room
          if (x < 0 || x > 49 || y < 0 || y > 49) continue;

          const adj = new RoomPosition(x, y, roomName);
          positions.push(adj);
        }
      }
    } else {
      positions.push(new RoomPosition(pos.x - 1, pos.y, roomName));
      positions.push(new RoomPosition(pos.x + 1, pos.y, roomName));
      positions.push(new RoomPosition(pos.x, pos.y - 1, roomName));
      positions.push(new RoomPosition(pos.x, pos.y + 1, roomName));
    }

    return positions;
  }

  private getFirstFreeAdjacentPosition(
    pos: RoomPosition,
    roomName: string,
    diagonals = true
  ): RoomPosition | undefined {
    const terrain = Game.rooms[roomName].getTerrain();
    const adjacent = this.getAdjacentPositions(pos, roomName, diagonals);
    const first = adjacent.find(
      p =>
        terrain.get(p.x, p.y) !== TERRAIN_MASK_WALL &&
        p.lookFor(LOOK_STRUCTURES).length === 0 &&
        p.lookFor(LOOK_CONSTRUCTION_SITES).length === 0
    );
    return first;
  }

  public run(): void {
    this.rescan();

    // If we don't have a container, see if we can have one
    if (this.containers.length === 0) {
      // Check for container construction sites
      const csite = this.constructionSites.find(
        s => s.structureType === STRUCTURE_CONTAINER
      );

      // TODO: set container max
      if (!csite) {
        const cPos = this.getFirstFreeAdjacentPosition(
          this.base,
          this.base.roomName
        );

        if (cPos) {
          const room = Game.rooms[this.base.roomName];
          const res = room.createConstructionSite(cPos, STRUCTURE_CONTAINER);
          console.log(`${this.name} container creation status: ${res}`);
        }
      }
    }

    // If we don't have a tower, see if we can have one
    if (this.towers.length === 0) {
      // Check for tower construction sites
      const csite = this.constructionSites.find(
        s => s.structureType === STRUCTURE_TOWER
      );

      // TODO: set tower max
      if (!csite) {
        const towerPos = this.getFirstFreeAdjacentPosition(
          this.base,
          this.base.roomName
        );

        if (towerPos) {
          const room = Game.rooms[this.base.roomName];
          const res = room.createConstructionSite(towerPos, STRUCTURE_TOWER);
          console.log(`${this.name} tower creation status: ${res}`);
        }
      }
    }

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

        if (
          !attendant.memory.harvesting &&
          attendant.store.getUsedCapacity(RESOURCE_ENERGY) === 0
        ) {
          attendant.memory.harvesting = true;
        }
        if (
          attendant.memory.harvesting &&
          attendant.store.getFreeCapacity(RESOURCE_ENERGY) === 0
        ) {
          attendant.memory.harvesting = false;
        }

        if (attendant.memory.harvesting) {
          // No energy. Grab energy from container.
          const container = this.containers.find(c => c.store[RESOURCE_ENERGY]);
          if (container) {
            const res = attendant.withdraw(container, RESOURCE_ENERGY);
            if (res === ERR_NOT_IN_RANGE) {
              attendant.moveTo(container);
            }
          } else {
            // Return to base
            if (attendant.pos.isEqualTo(this.base) === false) {
              attendant.moveTo(this.base);
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
          const rampart = this.ramparts
            .sort((a, b) => a.hits - b.hits)
            .find(r => r.hits < r.hitsMax);

          if (rampart) {
            if (attendant.repair(rampart) === ERR_NOT_IN_RANGE) {
              attendant.moveTo(rampart);
            }
            return;
          }

          // Repair roads
          const road = Outpost.lookWithinPerimeter(
            LOOK_STRUCTURES,
            this.base.roomName,
            this.perimeter
          )
            .filter(s => s.structure.structureType === STRUCTURE_ROAD)
            .map(s => s.structure as StructureRoad)
            .find(s => s.hits < s.hitsMax);

          if (road) {
            if (attendant.repair(road) === ERR_NOT_IN_RANGE) {
              attendant.moveTo(road);
            }
            return;
          }

          // Contribute to construction sites
          if (this.constructionSites.length) {
            const site = this.constructionSites[0];
            if (attendant.build(site) === ERR_NOT_IN_RANGE) {
              attendant.moveTo(site);
            }
            return;
          }

          // Return to base
          if (attendant.pos.isEqualTo(this.base) === false) {
            attendant.moveTo(this.base);
          }
        }
      });

    // Direct towers
    const hostiles = Outpost.lookWithinPerimeter(
      LOOK_CREEPS,
      this.base.roomName,
      this.perimeter
    )
      .map(x => x.creep)
      .filter(c => c.owner.username !== USERNAME);

    if (hostiles.length) {
      const target = hostiles.sort((a, b) => a.hits - b.hits).shift();
      if (target) this.towers.forEach(t => t.attack(target));
    } else {
      let towerAction: "heal" | "repair" | undefined;
      let conserveEnergy = false;

      const friendlies = Outpost.lookWithinPerimeter(
        LOOK_CREEPS,
        this.base.roomName,
        this.perimeter
      )
        .map(x => x.creep)
        .filter(c => c.owner.username === USERNAME && c.hits < c.hitsMax)
        .sort((a, b) => a.hits - b.hits);

      if (friendlies.length) towerAction = "heal";

      if (!towerAction) {
        const outpostEnergyCapacity = this.containers
          .map(c => c.store.getCapacity())
          .reduce((acc, val) => (acc += val), 0);
        const availableEnergy = this.containers
          .map(c => c.store[RESOURCE_ENERGY])
          .reduce((acc, val) => (acc += val), 0);

        conserveEnergy = availableEnergy < outpostEnergyCapacity * 0.5;
        if (!conserveEnergy) towerAction = "repair";
      }

      if (towerAction === "heal") {
        const toHeal = friendlies.shift();
        if (toHeal) this.towers.forEach(t => t.heal(toHeal));
      } else if (towerAction === "repair") {
        const rampart = this.ramparts
          .sort((a, b) => a.hits - b.hits)
          .filter(r => r.hits < r.hitsMax)
          .shift();
        if (rampart) {
          this.towers.forEach(t => t.repair(rampart));
        } else {
          const wall = this.walls.sort((a, b) => a.hits - b.hits).shift();

          if (wall) {
            this.towers.forEach(t => t.repair(wall));
          }
        }
      }
    }
  }

  public rescan(): void {
    // Capture construction sites
    this.constructionSites = Outpost.lookWithinPerimeter(
      LOOK_CONSTRUCTION_SITES,
      this.base.roomName,
      this.perimeter
    ).map(x => x.constructionSite);
    this.constructionSiteIds = this.constructionSites.map(s => s.id);
    this.memory.constructionSiteIds = this.constructionSiteIds;

    const structures = Outpost.lookWithinPerimeter(
      LOOK_STRUCTURES,
      this.base.roomName,
      this.perimeter
    ).map(x => x.structure);

    // Scan for spawn
    // TODO: Update with new spawn if a spawn outside perimeter was used.
    if (!this.spawn) {
      const spawn = structures
        .filter(x => x.structureType === STRUCTURE_SPAWN)
        .shift() as StructureSpawn;
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
      this.containerIds = structures
        .filter(s => s.structureType === STRUCTURE_CONTAINER)
        .map(c => c.id as Id<StructureContainer>);
      this.memory.containerIds = this.containerIds;
      Outpost.fillWithGameObjects(this.containers, this.containerIds);
    }

    // Always scan for updated ramparts
    this.rampartIds = structures
      .filter(s => s.structureType === STRUCTURE_RAMPART)
      .map(c => c.id as Id<StructureRampart>);
    this.memory.rampartIds = this.rampartIds;
    Outpost.fillWithGameObjects(this.ramparts, this.rampartIds);

    // Scan for a tower if we don't have at least one
    if (this.towerIds.length < 1) {
      this.towerIds = structures
        .filter(s => s.structureType === STRUCTURE_TOWER)
        .map(c => c.id as Id<StructureTower>);
      this.memory.towerIds = this.towerIds;
      Outpost.fillWithGameObjects(this.towers, this.towerIds);
    }

    // Always scan for updated walls
    this.wallIds = structures
      .filter(s => s.structureType === STRUCTURE_WALL)
      .map(c => c.id as Id<StructureWall>);
    this.memory.wallIds = this.wallIds;
    Outpost.fillWithGameObjects(this.walls, this.wallIds);
  }

  public requestResources(): ResourceRequestFromBucket[] {
    const requests: ResourceRequestFromBucket[] = [];

    // Request energy base on container level
    for (const container of this.containers) {
      const max = container.store.getCapacity();
      const used = container.store.getUsedCapacity(RESOURCE_ENERGY);

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

  public static drawOverlayFor(outpost: Outpost): void {
    const charsPerTiles = 5;
    const tileOffset = 3;
    const smallFont = "0.3 Courier New";
    const visual = new RoomVisual(outpost.base.roomName);
    const topleftX = outpost.perimeter.x.min;
    const topleftY = outpost.perimeter.y.min;
    const width = outpost.perimeter.x.max - topleftX;
    const height = outpost.perimeter.y.max - topleftY;

    const scoreColor: (score: number) => "green" | "yellow" | "red" = score =>
      score > 0.75 ? "green" : score > 0.4 ? "yellow" : "red";

    visual.rect(topleftX, topleftY, width, height, {
      fill: "transparent",
      stroke: "white",
      lineStyle: "dashed"
    });

    const info: [string, TextStyle | undefined][][] = [];

    // Overlay header with outpost name
    info.push([[outpost.name, { align: "left", font: "bold 1 Courier New" }]]);

    outpost.towers.forEach(t => {
      const energy = t.store[RESOURCE_ENERGY];
      const energyCapacity = t.store.getCapacity(RESOURCE_ENERGY);
      const energyColor = scoreColor(energy / energyCapacity);
      const hitsColor = scoreColor(t.hits / t.hitsMax);

      info.push([
        [`Tower (${t.pos.x},${t.pos.y}):`, { align: "left", font: smallFont }],
        [
          `Energy: ${energy}/${energyCapacity}`,
          { align: "left", font: smallFont, color: energyColor }
        ],
        [
          `Hits: ${t.hits}/${t.hitsMax}`,
          { align: "left", font: smallFont, color: hitsColor }
        ]
      ]);
    });

    outpost.attendants.forEach(a => {
      const hitsColor = scoreColor(a.hits / a.hitsMax);

      info.push([
        [`${a.name}:`, { align: "left", font: smallFont }],
        [
          `Hits: ${a.hits}/${a.hitsMax}`,
          { align: "left", font: smallFont, color: hitsColor }
        ]
      ]);
    });

    outpost.containers.forEach((c, i) => {
      const energy = c.store[RESOURCE_ENERGY];
      const energyCapacity = c.store.getCapacity(RESOURCE_ENERGY);
      const energyColor = scoreColor(energy / energyCapacity);

      info.push([
        [`Container ${i + 1}:`, { align: "left", font: smallFont }],
        [
          `Energy: ${energy}/${energyCapacity}`,
          { align: "left", font: smallFont, color: energyColor }
        ]
      ]);
    });

    const x = topleftX;
    for (let i = 1; i <= info.length; i++) {
      const set = info[i - 1];
      let tileBuffer = 0;
      for (const [str, style] of set) {
        const tilespan = Math.floor((str.length + tileOffset) / charsPerTiles);
        visual.text(str, x + tileBuffer, topleftY + i, style);
        tileBuffer += tilespan;
      }
    }
  }
}
