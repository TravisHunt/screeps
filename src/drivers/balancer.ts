import { RENEW_THRESHOLD } from "screeps.constants";
import ResourceService from "services/ResourceService";
import StorageService from "services/StorageService";
import { EnergyStructure, StoreStructure } from "utils/typeGuards";
import XPARTS from "utils/XPARTS";

/**
 * A driver whose main goal is distributing resources to structures. It's main
 * focus is ensuring that spawns and extensions are filled. This free's up
 * harvesters and streamlines spawning.
 */
export default class Balancer implements IRunnable {
  private static readonly role = "balancer";
  private static readonly roleMax = 1;
  private memory: RoomMemory;
  private spawns: StructureSpawn[];
  private extensions: StructureExtension[];
  private balancers: Creep[] = [];
  private resourceService: ResourceService;
  private storageService: StorageService;
  private room: Room;

  /**
   * A driver whose main goal is distributing resources to structures. It's main
   * focus is ensuring that spawns and extensions are filled. This free's up
   * harvesters and streamlines spawning.
   * @param memory - Memory for the balancer's room
   * @param spawns - All spawns in room
   * @param extensions - All extensions in room
   * @param balancers - All creep with balancer role
   * @param resourceService - ResourceService instance for room
   */
  public constructor(
    room: Room,
    memory: RoomMemory,
    spawns: StructureSpawn[],
    extensions: StructureExtension[],
    balancers: Creep[],
    resourceService: ResourceService
  ) {
    this.room = room;
    this.memory = memory;
    this.spawns = spawns;
    this.extensions = extensions;
    this.balancers = balancers;
    this.resourceService = resourceService;
    this.storageService = StorageService.getInstance();
  }

  /**
   * Runs per-tick balancer tasks.
   * 1) Attempt to spawn balancers if needed.
   * 2) Renew balancers if necessary.
   * 3) Driver balancers to haravest or distribute resources.
   */
  public run(): void {
    // Attempt to spawn a balancer
    if (this.balancers.length < Balancer.roleMax) {
      this.attemptBalancerSpawn();
    }

    // Drive balancers
    for (const creep of this.balancers) {
      // Do not driver spawning creeps.
      if (creep.spawning) continue;

      if (creep.ticksToLive && creep.ticksToLive < RENEW_THRESHOLD) {
        creep.memory.renewing = true;
      }

      // Renew until full.
      if (creep.memory.renewing) {
        const spawn = this.spawns[0];
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

      // Do not continue if we're still renewing.
      if (creep.memory.renewing) continue;

      const storage = this.storageService.getNearestStorage(creep.pos);

      // TODO: This code is really sloppy and needs to be cleaned up.
      if (creep.memory.balancing) {
        if (creep.energy() === 0) {
          const link = this.resourceService.getStorageLink();
          if (link && !link.empty()) {
            if (creep.withdraw(link, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
              creep.moveTo(link);
            }
            continue;
          } else {
            creep.memory.balancing = false;
          }
        } else {
          if (storage) {
            const res = creep.transfer(storage.target, RESOURCE_ENERGY);
            if (res === ERR_NOT_IN_RANGE) {
              creep.moveTo(storage.target);
              continue;
            } else if (res === ERR_FULL) {
              creep.memory.balancing = false;
            }
          } else {
            creep.memory.balancing = false;
          }
        }
      }
      if (creep.memory.balancing) continue;

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
        const link = this.resourceService.getStorageLink();
        if (link && !link.empty()) {
          if (creep.withdraw(link, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(link);
          }
        } else {
          // This will pull energy from storage (if we have one)
          this.resourceService.submitResourceRequest(creep, RESOURCE_ENERGY);
        }

        continue;
      }

      let needsEnergy: StoreStructure | EnergyStructure | undefined;

      // Prioritize spawns that aren't full.
      needsEnergy = this.spawns.find(
        s => s.store[RESOURCE_ENERGY] < SPAWN_ENERGY_CAPACITY
      );

      // Prioritize extensions after spawns.
      if (!needsEnergy) {
        needsEnergy = this.extensions.find(
          e => e.store[RESOURCE_ENERGY] < e.store.getCapacity(RESOURCE_ENERGY)
        );
      }

      // Do we have a terminal?
      if (!needsEnergy && storage && storage.reservesMet()) {
        const terminal = this.room.terminal;
        if (terminal && terminal.store[RESOURCE_ENERGY]) {
          needsEnergy = terminal;
        }
      }

      // NOTE: Add more energy balancing targets here.

      // Transfer energy to structure in need.
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
      } else {
        creep.memory.balancing = true;
      }
    }
  }

  /**
   * Attempts to schedule the spawn of a balancer through an available spawn.
   * @returns - Spawn status
   */
  private attemptBalancerSpawn(): ScreepsReturnCode {
    // We're busy if we can't find an available spawn.
    let res: ScreepsReturnCode = ERR_BUSY;

    const availableSpawn = this.spawns.find(s => !s.spawning);
    if (availableSpawn) {
      const parts = XPARTS([CARRY, 4], [MOVE, 4]);
      const name = `${Balancer.role}${Game.time}`;
      res = availableSpawn.spawnCreep(parts, name, {
        memory: { role: Balancer.role }
      });

      // Add new balancer name to memory so it's picked up on the next tick.
      if (res === OK) this.memory.balancerNames.push(name);
    }

    return res;
  }
}
