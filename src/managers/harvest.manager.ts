import ManagerBase from "managers/base.manager";
import { PATH_COLOR } from "palette";
import * as constants from "screeps.constants";
import ResourceService from "services/ResourceService";
import XPARTS from "utils/XPARTS";

export default class HarvestManager extends ManagerBase {
  public static readonly roleHarvester = "harvester";
  public readonly harvesterMax: number;
  public harvesters: Creep[];
  private resourceService: ResourceService;

  public constructor(
    room: Room,
    memory: RoomMemory,
    harvesterMax: number,
    resourceService: ResourceService
  ) {
    super(room, memory);

    this.harvesterMax = harvesterMax;
    this.resourceService = resourceService;

    this.harvesters = _.filter(
      Game.creeps,
      (creep: Creep) =>
        creep.memory.role === HarvestManager.roleHarvester &&
        creep.room.name === this.room.name
    );
  }

  public run(): void {
    // TODO: handle multiple spawns?
    const spawn = this.room.find(FIND_MY_SPAWNS)[0];

    // Spawn harvester if needed
    this.spawnHarvesters(spawn);

    this.harvesters.forEach(harvester => {
      this.work(harvester);
    });
  }

  private work(harvester: Creep) {
    // If below the ticks to live threshold, we want to renew until full.
    // Energy should be 0 for harvesters, because we don't want renewing
    // while in the middle of harvesting a source.
    if (
      harvester.energy() === 0 &&
      harvester.ticksToLive &&
      harvester.ticksToLive < constants.RENEW_THRESHOLD
    ) {
      harvester.memory.renewing = true;
      harvester.memory.harvesting = false;
      if (harvester.memory.harvestLock) {
        this.sourceService.unlockHarvestPosition(harvester.memory.harvestLock);
        delete harvester.memory.harvestLock;
      }
    }

    // Ask spawn service if it's my turn to renew.
    if (this.spawnService.canRenew(harvester)) {
      // Get Spawn instance from spawn service ledger.
      const spawn = this.spawnService.getSpawnForRenewal(harvester);

      // Attempt to renew
      const code = spawn.renewCreep(harvester);
      switch (code) {
        case OK:
          return;
        case ERR_NOT_IN_RANGE:
          harvester.moveTo(spawn, {
            visualizePathStyle: { stroke: PATH_COLOR }
          });
          // Return since moving is my tick action.
          return;
        case ERR_FULL:
          this.spawnService.renewalComplete(harvester);
          harvester.memory.renewing = false;
          break;
        default:
          console.log(`${harvester.name} renewing: ${code}`);
          return;
      }
    } else if (harvester.memory.renewing) {
      const position = this.spawnService.queueForRenewal(harvester);
      if (position === -1)
        console.log(`Failed to queue ${harvester.name} for renewal!`);
    }

    // Renewal skipped or finished. Continue with regular work.
    if (
      harvester.memory.harvesting &&
      harvester.freeCapacity(RESOURCE_ENERGY) === 0
    ) {
      harvester.memory.harvesting = false;
      // Return harvest position lock
      const lock = harvester.memory.harvestLock;
      if (lock) {
        this.sourceService.unlockHarvestPosition(lock);
        delete harvester.memory.harvestLock;
      }
    }
    if (
      !harvester.memory.harvesting &&
      harvester.usedCapacity(RESOURCE_ENERGY) === 0
    ) {
      harvester.memory.harvesting = true;
    }

    if (harvester.memory.harvesting) {
      // Obtain a lock to a harvest position
      if (!harvester.memory.harvestLock) {
        const lock = this.sourceService.lockHarvestPosition(harvester);
        if (lock) harvester.memory.harvestLock = lock;
      }
      // Obtained a lock. Move to harvest position.
      if (harvester.memory.harvestLock) {
        const lock = harvester.memory.harvestLock;
        if (harvester.pos.isEqualTo(lock.x, lock.y) === false) {
          harvester.moveTo(lock.x, lock.y);
        } else {
          const source = Game.getObjectById(lock.sourceId);
          if (!source) {
            console.log(`Source ${lock.sourceId} not found!`);
            this.sourceService.unlockHarvestPosition(lock);
            delete harvester.memory.harvestLock;
          } else {
            harvester.harvest(source);
          }
        }
      }
    } else {
      this.resourceService.deposit(harvester, RESOURCE_ENERGY);
    }
  }

  private spawnHarvesters(spawn: StructureSpawn) {
    if (this.harvesters.length < this.harvesterMax && !spawn.spawning) {
      // TODO: get parts based on spawn capacity
      const name = `Harvester${Game.time}`;
      const babyBoi = [WORK, CARRY, MOVE];
      const mediumBoi = XPARTS([WORK, 2], [CARRY, 3], [MOVE, 4]);
      const bigBoi = XPARTS([WORK, 3], [CARRY, 6], [MOVE, 6]);

      console.log(`Spawning new harvester: ${name}`);
      let res = spawn.spawnCreep(bigBoi, name, {
        memory: { role: HarvestManager.roleHarvester, harvesting: false }
      });

      if (res === ERR_NOT_ENOUGH_ENERGY) {
        res = spawn.spawnCreep(mediumBoi, name, {
          memory: { role: HarvestManager.roleHarvester, harvesting: false }
        });
      }
      if (res === ERR_NOT_ENOUGH_ENERGY) {
        res = spawn.spawnCreep(babyBoi, name, {
          memory: { role: HarvestManager.roleHarvester, harvesting: false }
        });
      }
    }
  }
}
