import ManagerBase from "managers/base.manager";
import * as constants from "screeps.constants";
import ResourceService from "services/ResourceService";

export default class HarvestManager extends ManagerBase {
  public static readonly roleHarvester = "harvester";
  public readonly harvesterMax: number;
  public harvesters: Creep[];
  private resourceService: ResourceService;

  public constructor(
    room: Room,
    harvesterMax: number,
    resourceManager: ResourceService
  ) {
    super(room);

    this.harvesterMax = harvesterMax;
    this.resourceService = resourceManager;

    this.harvesters = _.filter(
      Game.creeps,
      (creep: Creep) =>
        creep.memory.role === HarvestManager.roleHarvester &&
        creep.room.name === this.room.name
    );
  }

  public get schedule(): BuildSchedule {
    return Memory.buildSchedules[this.room.name];
  }

  public run(): void {
    // TODO: handle multiple spawns?
    const spawn = this.room.find(FIND_MY_SPAWNS)[0];

    // Spawn harvester if needed
    this.spawnHarvesters(spawn);

    this.harvesters.forEach(harvester => {
      this.work(harvester, spawn);
    });
  }

  private work(harvester: Creep, spawn: StructureSpawn) {
    if (
      harvester.memory.harvesting &&
      harvester.store.getFreeCapacity(RESOURCE_ENERGY) === 0
    ) {
      harvester.memory.harvesting = false;
    }
    if (
      !harvester.memory.harvesting &&
      harvester.store.getUsedCapacity(RESOURCE_ENERGY) === 0
    ) {
      // Should I renew?
      const shouldRenew =
        harvester.ticksToLive &&
        harvester.ticksToLive < constants.RENEW_THRESHOLD;
      const creepSize = harvester.body.length;
      const creepCost = harvester.body
        .map(part => BODYPART_COST[part.type])
        .reduce((total, val) => total + val);
      const renewCost = Math.ceil(creepCost / 2.5 / creepSize);

      if (shouldRenew && spawn.store[RESOURCE_ENERGY] > renewCost) {
        if (spawn.renewCreep(harvester) === ERR_NOT_IN_RANGE) {
          harvester.moveTo(spawn);
          return;
        }
      }

      harvester.memory.harvesting = true;
      harvester.say("🔄 harvest");
    }

    if (harvester.memory.harvesting) {
      this.resourceService.submitResourceRequest(harvester, RESOURCE_ENERGY, {
        ignoreStores: true
      });
    } else {
      this.resourceService.deposit(harvester, RESOURCE_ENERGY);
    }
  }

  private spawnHarvesters(spawn: StructureSpawn) {
    if (this.harvesters.length < this.harvesterMax && !spawn.spawning) {
      // TODO: get parts based on spawn capacity
      const name = `Harvester${Game.time}`;
      const parts = [WORK, CARRY, MOVE];
      const big = [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];

      console.log(`Spawning new harvester: ${name}`);
      const res = spawn.spawnCreep(big, name, {
        memory: { role: HarvestManager.roleHarvester, harvesting: false }
      });

      if (res === ERR_NOT_ENOUGH_ENERGY) {
        spawn.spawnCreep(parts, name, {
          memory: { role: HarvestManager.roleHarvester, harvesting: false }
        });
      }
    }
  }
}
