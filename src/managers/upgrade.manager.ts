import ManagerBase from "managers/base.manager";
import { palette } from "path.palette";

export default class UpgradeManager extends ManagerBase {
  public static readonly role = "upgrader";
  public readonly room: Room;
  public readonly creepMax: number;
  public creeps: Creep[];

  public constructor(room: Room, max: number) {
    super();
    this.room = room;
    this.creepMax = max;
    this.creeps = _.filter(
      Game.creeps,
      (creep: Creep) => creep.memory.role === UpgradeManager.role && creep.room.name === this.room.name
    );
  }

  public run(): void {
    // TODO: handle multiple spawns?
    const spawn = this.room.find(FIND_MY_SPAWNS)[0];

    // create upgraders if we don't have enough
    if (this.creeps.length < this.creepMax && !spawn.spawning) {
      UpgradeManager.create(spawn);
    }

    for (const creep of this.creeps) {
      UpgradeManager.doYourJob(creep);
    }
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
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: palette.upgrade } });
        }
      } else {
        creep.say("ERROR: No ctrl");
      }
    } else {
      const sources = creep.room.find(FIND_SOURCES);
      if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(sources[0], { visualizePathStyle: { stroke: palette.harvest } });
      }
    }
  }

  public static create(spawn: StructureSpawn): void {
    const name = `Upgrader${Game.time}`;
    const parts = [WORK, CARRY, MOVE];
    const opts = { memory: { role: this.role, upgrading: false } };
    if (spawn.spawnCreep(parts, name, opts) === OK) console.log("Spawning new upgrader: " + name);
  }
}
