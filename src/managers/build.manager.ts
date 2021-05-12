/* eslint-disable no-underscore-dangle */
export default class BuildManager {
  public static readonly role = "builder";
  public readonly creepMax: number;
  public builders: Creep[];
  public buildSites: ConstructionSite[];
  private room: Room;
  private _openPositions: number;

  public constructor(room: Room, max: number) {
    this.room = room;
    this.creepMax = max;
    this.builders = _.filter(Game.creeps, (creep: Creep) => creep.memory.role === BuildManager.role);
    this.buildSites = room.find(FIND_CONSTRUCTION_SITES);
    this._openPositions = max - this.builders.length;
  }

  public get openPositions(): number {
    return this._openPositions;
  }

  public run(): void {
    // Spawn builder if we need one
    const spawn = this.room.find(FIND_MY_SPAWNS)[0];
    if (this.buildSites.length && this.builders.length < this.creepMax && !spawn.spawning) {
      BuildManager.create(spawn);
    }

    // Assign jobs
    this.builders.forEach(builder => {
      // Clear completed job
      if (builder.memory.job && builder.memory.job.complete) delete builder.memory.job;

      if (!builder.memory.job && this.buildSites.length) {
        // Assign to first available job
        const buildSite = this.buildSites[0];
        builder.memory.job = { siteId: buildSite.id, complete: false };
      }

      BuildManager.doYourJob(builder);
    });
  }

  public static doYourJob(creep: Creep): void {
    // TODO: make sure the creep is capable of this job

    // Harvest if you have no more energy
    if (creep.memory.building && creep.store.getUsedCapacity() === 0) {
      creep.memory.building = false;
      creep.say("🔄 harvest");
    }

    // Build if you're at carrying capacity
    if (!creep.memory.building && creep.store.energy === creep.store.getCapacity()) {
      creep.memory.building = true;
      creep.say("🚧 build");
    }

    // Loop action: build site or harvest from energy source
    if (creep.memory.building) {
      if (creep.memory.job) {
        const buildSite: ConstructionSite | null = Game.getObjectById(creep.memory.job.siteId);

        if (buildSite) {
          const buildResponse = creep.build(buildSite);
          switch (creep.build(buildSite)) {
            case OK:
              creep.say("🚧 build");
              break;
            case ERR_NOT_IN_RANGE:
              creep.moveTo(buildSite, { visualizePathStyle: { stroke: "#ffffff" } });
              break;
            case ERR_INVALID_TARGET:
              creep.say("ERR: INVALID TARGET");
              creep.memory.job.complete = true;
              break;
            default:
              creep.say(`ERR: ${buildResponse}`);
          }
        } else {
          creep.say("ERR: I HAVE NO SITE");
          creep.memory.job.complete = true;
        }
      } else {
        creep.say("ERR: NO JOB");
      }
    } else {
      const sources = creep.room.find(FIND_SOURCES);
      if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(sources[0], { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    }
  }

  public static create(spawn: StructureSpawn): void {
    const name = `Builder${Game.time}`;
    console.log("Spawning new builder: " + name);
    spawn.spawnCreep([WORK, CARRY, MOVE], name, { memory: { role: this.role, building: false } });
  }
}
