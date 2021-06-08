import { RENEW_THRESHOLD } from "screeps.constants";
import ResourceService from "services/ResourceService";
import { EnergyStructure } from "utils/typeGuards";
import XPARTS from "utils/XPARTS";

export default class Balancer {
  private static readonly role = "balancer";
  private static readonly roleMax = 1;
  private memory: RoomMemory;
  private spawns: StructureSpawn[];
  private extensions: StructureExtension[];
  private balancers: Creep[] = [];
  private resourceService: ResourceService;

  public constructor(
    memory: RoomMemory,
    spawns: StructureSpawn[],
    extensions: StructureExtension[],
    balancers: Creep[],
    resourceService: ResourceService
  ) {
    this.memory = memory;
    this.spawns = spawns;
    this.extensions = extensions;
    this.balancers = balancers;
    this.resourceService = resourceService;
  }

  public run(): void {
    // Attempt to spawn a balancer
    if (this.balancers.length < Balancer.roleMax) {
      const availableSpawn = this.spawns.find(s => !s.spawning);
      if (availableSpawn) {
        const parts = XPARTS([CARRY, 4], [MOVE, 4]);
        const name = `${Balancer.role}${Game.time}`;
        const res = availableSpawn.spawnCreep(parts, name, {
          memory: { role: Balancer.role }
        });

        if (res === OK) this.memory.balancerNames.push(name);
      }
    }

    // Drive balancers
    for (const creep of this.balancers) {
      if (creep.ticksToLive && creep.ticksToLive < RENEW_THRESHOLD) {
        creep.memory.renewing = true;
      }

      const spawn = this.spawns[0];

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
      }

      if (creep.memory.renewing) continue;

      // Toggle state variables
      if (
        creep.memory.harvesting &&
        creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
      ) {
        creep.memory.harvesting = false;
      }
      if (
        !creep.memory.harvesting &&
        creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0
      ) {
        creep.memory.harvesting = true;
      }

      // Gather energy
      if (creep.memory.harvesting) {
        this.resourceService.submitResourceRequest(creep, RESOURCE_ENERGY);
        continue;
      }

      let needsEnergy: EnergyStructure | undefined;

      // Fill spawns
      needsEnergy = this.spawns.find(
        s => s.store[RESOURCE_ENERGY] < SPAWN_ENERGY_CAPACITY
      );

      // Fill extensions
      if (!needsEnergy) {
        needsEnergy = this.extensions.find(
          e => e.store[RESOURCE_ENERGY] < e.store.getCapacity(RESOURCE_ENERGY)
        );
      }

      if (needsEnergy) {
        const res = creep.transfer(needsEnergy, RESOURCE_ENERGY);
        if (res === ERR_NOT_IN_RANGE) {
          creep.moveTo(needsEnergy);
        } else if (res === OK) {
          // If creep has no energy, set to harvest
          if (creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.harvesting = true;
          }
        }
      }
    }
  }
}
