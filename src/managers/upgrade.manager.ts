import ManagerBase from "managers/base.manager";
import ResourceManager from "managers/resource/resource.manager";
import * as palette from "palette";

export default class UpgradeManager extends ManagerBase {
  public static readonly role = "upgrader";
  public readonly creepMax: number;
  public creeps: Creep[];
  private resourceManager: ResourceManager;

  public constructor(
    room: Room,
    max: number,
    resourceManager: ResourceManager
  ) {
    super(room);
    this.creepMax = max;
    this.resourceManager = resourceManager;

    this.creeps = _.filter(
      Game.creeps,
      (creep: Creep) =>
        creep.memory.role === UpgradeManager.role &&
        creep.room.name === this.room.name
    );
  }

  public run(): void {
    // TODO: handle multiple spawns?
    const spawn = this.room.find(FIND_MY_SPAWNS)[0];

    // create upgraders if we don't have enough
    if (this.creeps.length < this.creepMax && !spawn.spawning) {
      UpgradeManager.create(spawn, this.room.energyCapacityAvailable);
    }

    for (const creep of this.creeps) {
      this.doYourJob(creep);
    }
  }

  public doYourJob(creep: Creep): void {
    // TODO: make sure the creep is capable of this job

    // Harvest if you have no more energy
    if (
      !creep.memory.harvesting &&
      creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0
    ) {
      creep.memory.harvesting = true;
      creep.say("🔄 harvest");
    }

    // Upgrade if you're at carrying capacity
    if (
      creep.memory.harvesting &&
      creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
    ) {
      creep.memory.harvesting = false;
      creep.say("⚡ upgrade");
    }

    // Loop action: upgrade controller or harvest from energy source
    if (creep.memory.harvesting) {
      this.resourceManager.withdraw(creep, RESOURCE_ENERGY);
      return;
    }

    if (creep.room.controller) {
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, {
          visualizePathStyle: { stroke: palette.PATH_COLOR_UPGRADE }
        });
      }
    } else {
      creep.say("ERROR: No ctrl");
    }
  }

  public static create(spawn: StructureSpawn, energyCapacity: number): void {
    const name = `Upgrader${Game.time}`;
    const parts =
      energyCapacity >= 550
        ? [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]
        : [WORK, CARRY, MOVE];
    const opts = { memory: { role: this.role, upgrading: false } };
    if (spawn.spawnCreep(parts, name, opts) === OK)
      console.log("Spawning new upgrader: " + name);
  }
}
