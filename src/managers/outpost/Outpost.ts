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
  public perimeter: Perimeter;
  private spawnName: string | undefined;
  private containerIds: Id<StructureContainer>[];
  private rampartIds: Id<StructureRampart>[];
  private towerIds: Id<StructureTower>[];
  private wallIds: Id<StructureWall>[];
  private attendantNames: string[];

  public get memory(): OutpostMemory {
    return Memory.outposts[this.base.roomName].outposts.find(
      m => m.name === this.name
    ) as OutpostMemory;
  }

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
    this.perimeter = mem.perimeter;
    this.base = new RoomPosition(mem.base.x, mem.base.y, mem.base.roomName);

    this.containerIds = mem.containerIds || [];
    this.rampartIds = mem.rampartIds || [];
    this.towerIds = mem.towerIds || [];
    this.wallIds = mem.wallIds || [];
    this.attendantNames = mem.attendantNames || [];

    if (this.spawnName && Game.spawns[this.spawnName]) {
      this.spawn = Game.spawns[this.spawnName];
    }

    // Get all game objects with matching ids
    Outpost.fillWithGameObjects(this.containers, this.containerIds);
    Outpost.fillWithGameObjects(this.ramparts, this.rampartIds);
    Outpost.fillWithGameObjects(this.towers, this.towerIds);
    Outpost.fillWithGameObjects(this.walls, this.wallIds);

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
          .reduce((acc, val) => (acc += val));
        const availableEnergy = this.containers
          .map(c => c.store[RESOURCE_ENERGY])
          .reduce((acc, val) => (acc += val));

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
