import ManagerBase from "managers/base.manager";
import * as palette from "palette";
import XPARTS from "utils/XPARTS";
import { RENEW_THRESHOLD } from "screeps.constants";
import ResourceService from "services/ResourceService";
import { PATH_COLOR } from "palette";

export default class UpgradeManager extends ManagerBase {
  public static readonly role = "upgrader";
  public readonly creepMax: number;
  public creeps: Creep[];
  private resourceService: ResourceService;

  public constructor(
    room: Room,
    memory: RoomMemory,
    max: number,
    resourceService: ResourceService
  ) {
    super(room, memory);
    this.creepMax = max;
    this.resourceService = resourceService;

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
    // Check for renewal
    if (creep.ticksToLive && creep.ticksToLive < RENEW_THRESHOLD) {
      creep.memory.harvesting = false;
      creep.memory.renewing = true;
      if (creep.memory.harvestLock) {
        // Abandon harvest position
        this.sourceService.unlockHarvestPosition(creep.memory.harvestLock);
        delete creep.memory.harvestLock;
      }
    }

    // Ask spawn service if it's my turn to renew
    if (this.spawnService.canRenew(creep)) {
      const spawn = this.spawnService.getSpawnForRenewal(creep);

      // Attempt to renew
      const code = spawn.renewCreep(creep);
      switch (code) {
        case OK:
          return;
        case ERR_NOT_IN_RANGE:
          creep.moveTo(spawn, { visualizePathStyle: { stroke: PATH_COLOR } });
          return;
        case ERR_FULL:
          // Tell spawn service that I'm done renewing
          this.spawnService.renewalComplete(creep);
          creep.memory.renewing = false;
          break;
        default:
          creep.say("Renew Error!");
          console.log(`${creep.name} renew failed with code: ${code}`);
          return;
      }
    } else if (creep.memory.renewing) {
      // Trying to renew but it's not my turn or I haven't queued yet.
      const position = this.spawnService.queueForRenewal(creep);
      if (position === -1)
        console.log(`Failed to queue ${creep.name} for renewal!`);
    }

    // Harvest if you have no more energy
    if (!creep.memory.harvesting && !creep.usedCapacity(RESOURCE_ENERGY)) {
      creep.memory.harvesting = true;
      creep.say("🔄 harvest");
    }

    // Upgrade if you're at carrying capacity
    if (creep.memory.harvesting && !creep.freeCapacity(RESOURCE_ENERGY)) {
      creep.memory.harvesting = false;
      creep.say("⚡ upgrade");
      // Return harvest position lock if we have one
      const lock = creep.memory.harvestLock;
      if (lock) {
        this.sourceService.unlockHarvestPosition(lock);
        delete creep.memory.harvestLock;
      }
    }

    // Loop action: upgrade controller or harvest from energy source
    if (creep.memory.harvesting) {
      // Prioritize the upgrade link if it exists
      const link = this.resourceService.getUpgradeLink();
      if (link && !link.empty()) {
        if (creep.withdraw(link, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(link, {
            visualizePathStyle: { stroke: palette.PATH_COLOR_HARVEST }
          });
        }
        return;
      }

      // No upgrade link? Check for a storage container.
      const storage = this.storageService.getNearestStorage(creep.pos);
      if (storage && !storage.empty()) {
        if (creep.withdraw(storage.obj, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(storage, {
            visualizePathStyle: { stroke: palette.PATH_COLOR_HARVEST }
          });
        }
        return;
      }

      // If we're here we couldn't find an energy container. Let's try to
      // claim a harvest position.
      if (!creep.memory.harvestLock) {
        const lock = this.sourceService.lockHarvestPosition(creep);
        if (lock) creep.memory.harvestLock = lock;
      }
      // We obtained a lock, let's use it.
      if (creep.memory.harvestLock) {
        const lock = creep.memory.harvestLock;
        // Move to locked position if we're not there.
        if (creep.pos.isEqualTo(lock.x, lock.y) === false) {
          creep.moveTo(lock.x, lock.y);
        } else {
          const source = Game.getObjectById(lock.sourceId);
          if (!source) {
            console.log(`Upgrader: Source ${lock.sourceId} not found!`);
            this.sourceService.unlockHarvestPosition(lock);
            delete creep.memory.harvestLock;
          } else {
            creep.harvest(source);
          }
        }
        return;
      }
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
