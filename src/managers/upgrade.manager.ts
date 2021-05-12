/* eslint-disable no-underscore-dangle */
export default class UpgradeManager {
  public static readonly role = "upgrader";
  public readonly creepMax: number;
  public creeps: Creep[];
  private _openPositions: number;

  public constructor(max: number, creeps: Creep[]) {
    this.creepMax = max;
    this.creeps = creeps;
    this._openPositions = max - creeps.length;
  }

  public get openPositions(): number {
    return this._openPositions;
  }

  public static doYourJob(creep: Creep): void {
    // TODO: make sure the creep is capable of this job

    // Harvest if you have no more energy
    if (creep.memory.upgrading && creep.store.getUsedCapacity() === 0) {
      creep.memory.upgrading = false;
      creep.say("🔄 harvest");
    }

    // Upgrade if you're at carrying capacity
    if (!creep.memory.upgrading && creep.store.energy === creep.store.getCapacity()) {
      creep.memory.upgrading = true;
      creep.say("⚡ upgrade");
    }

    // Loop action: upgrade controller or harvest from energy source
    if (creep.memory.upgrading) {
      if (creep.room.controller) {
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else {
        creep.say("ERROR: No ctrl");
      }
    } else {
      const sources = creep.room.find(FIND_SOURCES);
      if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(sources[0], { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    }
  }

  public static create(spawn: StructureSpawn): void {
    const name = `Upgrader${Game.time}`;
    console.log("Spawning new upgrader: " + name);
    spawn.spawnCreep([WORK, CARRY, MOVE], name, { memory: { role: this.role, working: false, upgrading: false } });
  }
}
