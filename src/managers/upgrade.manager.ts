import ManagerBase from "managers/base.manager";
import ResourceManager from "managers/resource/resource.manager";
import * as palette from "palette";
import XPARTS from "utils/XPARTS";
import { RENEW_THRESHOLD } from "screeps.constants";

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
      this.doYourJob(creep, spawn);
    }
  }

  public doYourJob(creep: Creep, spawn: StructureSpawn): void {
    // TODO: make sure the creep is capable of this job
    if (creep.ticksToLive && creep.ticksToLive < RENEW_THRESHOLD) {
      creep.memory.renewing = true;
    }

    // Renew until full
    if (creep.memory.renewing) {
      const res = spawn.renewCreep(creep);
      switch (res) {
        case ERR_NOT_IN_RANGE:
          creep.moveTo(spawn);
          break;
        case ERR_FULL:
          creep.memory.renewing = false;
          break;
      }
      return;
    }

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
      this.resourceManager.withdraw(creep, RESOURCE_ENERGY, {
        upgrading: true
      });
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
      energyCapacity >= 1250
        ? XPARTS([WORK, 3], [CARRY, 8], [MOVE, 11])
        : energyCapacity >= 550
        ? XPARTS([WORK, 2], [CARRY, 3], [MOVE, 4])
        : [WORK, CARRY, MOVE];
    const opts = { memory: { role: this.role } };
    if (spawn.spawnCreep(parts, name, opts) === OK)
      console.log("Spawning new upgrader: " + name);
  }
}
