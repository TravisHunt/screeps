import * as constants from "screeps.constants";
import * as utils from "./utils";
import ManagerBase from "managers/base.manager";
import ManagedSource from "./ManagedSource";
import HarvestQueue from "./HarvestQueue";
import * as palette from "palette";
import {
  EnergyStructure,
  StoreStructure,
  isEnergyStructure,
  isStoreStructure
} from "utils/typeGuards";
import Queue from "utils/Queue";
import XPARTS from "utils/XPARTS";

export default class ResourceManager extends ManagerBase {
  public static readonly roleCourier = "courier";
  private courierMax: number;
  private sources: ManagedSource[] = [];
  private containers: StructureContainer[] = [];
  private storageUnits: StructureStorage[] = [];
  private harvestQueue: HarvestQueue;
  private deliveryQueue: Queue<ResourceRequestFromBucket>;
  private couriers: Creep[] = [];

  public constructor(room: Room, courierMax: number) {
    super(room);

    this.init();

    this.courierMax = courierMax;
    this.sources = this.memory.sources.map(s => new ManagedSource(s));

    // const containers = this.memory.containers
    this.containers = this.memory.containers
      .map(id => Game.getObjectById(id))
      .filter(c => c !== null) as StructureContainer[];

    this.storageUnits = this.memory.storageUnits.map(
      id => Game.getObjectById(id) as StructureStorage
    );

    if (!this.memory.harvestQueue) this.memory.harvestQueue = [];
    if (!this.memory.deliveryQueue) this.memory.deliveryQueue = [];
    this.harvestQueue = new HarvestQueue(this.memory.harvestQueue);
    this.deliveryQueue = new Queue<ResourceRequestFromBucket>(
      this.memory.deliveryQueue
    );

    // gather couriers
    this.memory.courierNames = this.memory.courierNames.filter(
      name => name in Game.creeps
    );
    this.couriers = this.memory.courierNames.map(name => Game.creeps[name]);
  }

  /**
   * Short-hand for Memory.resources[this.room.name]
   */
  private get memory(): ResourceManagerMemory {
    return Memory.resources[this.room.name];
  }

  /**
   * Short-hand setting Memory.resources[this.room.name]
   */
  private set memory(memory: ResourceManagerMemory) {
    Memory.resources[this.room.name] = memory;
  }

  public get harvestPositionCount(): number {
    let count = 0;

    for (const src of this.sources) {
      count += src.positions.length;
    }

    return count;
  }

  private getAvailableHarvestPosition(): OccupiablePosition | undefined {
    for (const managed of this.sources) {
      const pos = managed.getAvailablePosition();
      if (pos) return pos;
    }

    return undefined;
  }

  public run(): void {
    // Run harvest jobs for creeps occupying harvest positions.
    // Clear occupied spaces where the occupier is done harvesting.
    for (const source of this.sources) {
      const insight = source.run();

      if (constants.debug) {
        const { done, dead } = insight.cleanUp;
        if (done || dead) {
          console.log(
            `Source ${source.source.id} cleaned | done: ${done}, dead: ${dead}`
          );
        }
      }
    }

    // Assign unoccupied harvest positions to creeps waiting in the queue
    if (this.harvestQueue.length) {
      // Get the number of unoccupied harvest positions
      const unoccupied = this.sources
        .map(ms => ms.unoccupiedPositions.length)
        .reduce((acc, val) => acc + val);

      // The number of assignments is equal to either the number of unoccupied
      // spaces or the number of creeps in the queue, whichever is smallest.
      const assignmentsOrdered = Math.min(this.harvestQueue.length, unoccupied);
      let assignmentsComplete = 0;

      // For each unoccupied position, dequeue the first creep in line and
      // assign them to an unoccupied harvest position.
      while (assignmentsComplete < assignmentsOrdered) {
        const harvestRequest = this.harvestQueue.dequeue();
        if (!harvestRequest)
          throw new Error("Harvest Queue was empty when assigning positions");

        const creep = Game.getObjectById(harvestRequest[0]);

        // If the creep died waiting in the queue, we increment the action
        // counter and continue to ensure that we don't pull more from the
        // queue then we want to.
        if (!creep) {
          assignmentsComplete++;
          continue;
        }

        // Assign the creep to the first available harvest position
        // TODO: Find best available position based on creep's position
        const harvestPos = this.getAvailableHarvestPosition();
        if (harvestPos) {
          harvestPos.occuiped = {
            creepId: harvestRequest[0],
            requested: harvestRequest[1],
            start: creep.store.getUsedCapacity(RESOURCE_ENERGY),
            progress: 0
          };

          assignmentsComplete++;
        } else {
          throw new Error(
            "No available harvest positions when one was expected"
          );
        }
      }
    }

    // TODO: I don't think this is actually necessary. Investigate if
    // the queue instance properly saves to memory.
    // Save updated harvest queue to memory
    this.memory.harvestQueue = this.harvestQueue.queue;

    // Highlight occupiable resource positions while in debug mode
    if (constants.debug) {
      const visual = new RoomVisual(this.room.name);
      const positions = this.sources
        .map(s => s.positions)
        .reduce((acc, val) => acc.concat(val), []);
      for (const pos of positions) {
        const color = pos.occuiped
          ? palette.HARVEST_POS_OCCUPIED
          : palette.HARVEST_POS;
        visual.circle(pos.x, pos.y, { fill: color, radius: 0.5 });
      }
    }

    // Assign queued contracts if we have any.
    if (this.deliveryQueue.length) {
      while (this.deliveryQueue.length > 0) {
        const courier = this.getAvailableCourier();

        if (!courier) {
          // Can we spawn a new courier to meet demand?
          if (this.couriers.length < this.courierMax) {
            if (this.trySpawnCourier() === OK) {
              console.log("Spawning Courier...");
            }
          }
          break;
        } else {
          const contract = this.deliveryQueue.dequeue();
          if (contract) {
            courier.memory.contract = contract as ResourceDeliveryContract;
            // TODO: initialize delivered value in constructor
            courier.memory.contract.delivered = 0;
          }
        }
      }
    }

    // TODO: I don't think this is actually necessary. Investigate if
    // the queue instance properly saves to memory.
    // Save updated delivery queue to memory
    this.memory.deliveryQueue = this.deliveryQueue.queue;

    // Couriers without contracts return home and unload
    this.couriers
      .filter(c => !c.spawning && c.memory.contract === undefined)
      .forEach(c => {
        if (this.room.storage) {
          for (const type in c.store) {
            const res = c.transfer(this.room.storage, type as ResourceConstant);
            if (res === ERR_NOT_IN_RANGE) {
              c.moveTo(this.room.storage);
              break;
            }
          }
        }
      });

    // Direct couriers with contracts
    this.couriers
      .filter(c => !c.spawning && c.memory.contract !== undefined)
      .forEach(c => {
        if (!c.memory.contract) return; // stupid type safety
        const contract = c.memory.contract;

        if (contract.delivered >= contract.amount) {
          // Contract complete. Delete and return.
          delete c.memory.contract;
          return;
        }

        if (!c.memory.harvesting && c.store.getFreeCapacity(contract.type)) {
          c.memory.harvesting = true;
        }
        if (c.memory.harvesting && c.store.getFreeCapacity() === 0) {
          // Should I renew?
          const shouldRenew =
            c.ticksToLive && c.ticksToLive < constants.RENEW_THRESHOLD;
          const cSize = c.body.length;
          const cCost = c.body
            .map(part => BODYPART_COST[part.type])
            .reduce((total, val) => total + val);
          const renewCost = Math.ceil(cCost / 2.5 / cSize);
          console.log(
            `Should renew: ${
              shouldRenew ? "YES" : "NO"
            }, Renew cost: ${renewCost}`
          );
          if (shouldRenew) {
            const spawn = c.pos.findClosestByRange(FIND_MY_SPAWNS);
            if (spawn && spawn.store[RESOURCE_ENERGY] > renewCost) {
              if (spawn.renewCreep(c) === ERR_NOT_IN_RANGE) {
                c.moveTo(spawn);
                return;
              }
            }
          }

          c.memory.harvesting = false;
        }

        if (c.memory.harvesting) {
          const withdrawAmt = Math.min(
            contract.amount,
            c.store.getFreeCapacity(contract.type)
          );

          this.withdraw(c, contract.type, { amount: withdrawAmt });
        } else {
          const bucket = Game.getObjectById(contract.bucketId);

          if (!bucket) {
            // Assume the bucket no longer exists. Close contract.
            delete c.memory.contract;
            return;
          }

          // TODO: Check available bucket space
          // const freeBucketSpace = bucket.store.getCapacity() - bucket.store[contract.type];
          // if (!freeBucketSpace) {
          //   delete c.memory.contract;
          //   return;
          // }
          const transferAmt = Math.min(
            contract.amount - contract.delivered,
            c.store.getUsedCapacity(contract.type)
          );
          const transferRes = c.transfer(bucket, contract.type, transferAmt);

          if (transferRes === OK) {
            contract.delivered += transferAmt;
            c.say(`${contract.delivered}/${contract.amount}`);
            if (contract.delivered >= contract.amount) {
              // Contract complete. Close contract.
              delete c.memory.contract;
            }
          } else if (transferRes === ERR_FULL) {
            // Contract complete. Close contract.
            delete c.memory.contract;
          } else if (transferRes === ERR_NOT_IN_RANGE) {
            c.moveTo(bucket.pos);
          }
        }
      });
  }

  /**
   * Request a type of resource be loaded into the given creep. The resource
   * manager will provide what it can if the entire order cannot be filled.
   * If no amount is specified, the manager will attempt to fill the creep to
   * capacity.
   * @param creep - The creep that needs the resource
   * @param type - The type of resource being requested
   * @param opts - Optional values for withdraw request
   * @returns A code indicating the status of the withdraw request
   */
  public withdraw<R extends ResourceConstant>(
    creep: Creep,
    type: R,
    opts?: WithdrawOpts
  ): utils.ResourceReturnCode {
    if (creep.spawning) return utils.ERR_CREEP_SPAWNING;
    switch (type) {
      case RESOURCE_ENERGY:
        return this.withdrawEnergy(creep, opts);
      default:
        console.log("ResourceManager.withdraw: RESOURCE NOT IMPLEMENTED");
        return utils.ERR_RESOURCE_NOT_IMPLEMENTED;
    }
  }

  public getInNeedOfRepair(): Structure<StructureConstant>[] {
    const structures: Structure<StructureConstant>[] = [];

    for (const source of this.sources) {
      source.positionsInNeedOfRepair.forEach(s => structures.push(s));
    }

    // TODO: handle managed containers and storage

    return structures;
  }

  public requestBuilds(): BuildRequest[] {
    const requests: BuildRequest[] = [];

    // Gather any harvest positions that have yet to be built. Sort by harvest
    // position count so the source with the least amount of positions is
    // queued first.
    const sortedByHarvestPosCount = this.sources.sort(
      (a, b) => a.positions.length - b.positions.length
    );
    for (const src of sortedByHarvestPosCount) {
      const positions = src.findExpansionPositions();
      if (positions.length) {
        requests.push({ type: STRUCTURE_ROAD, positions });
      }
    }

    return requests;
  }

  public acceptResourceRequests(requests: ResourceRequestFromBucket[]): void {
    for (const req of requests) {
      // See if a request to fill this bucket with this resource has already
      // been made before queueing the request.
      const match = this.deliveryQueue.queue.find(
        x => x.bucketId === req.bucketId && x.type === req.type
      );
      const working = this.couriers.find(
        c =>
          c.memory.contract &&
          c.memory.contract.bucketId === req.bucketId &&
          c.memory.contract.type === req.type
      );
      if (!match && !working) {
        console.log(`Request queued: ${JSON.stringify(req)}`);
        this.deliveryQueue.enqueue(req);
      }
    }
  }

  private getAvailableCourier(): Creep | undefined {
    return this.couriers.find(c => !c.spawning && !c.memory.contract);
  }

  private trySpawnCourier(): ScreepsReturnCode {
    // Find a spawn in this room that isn't currently spawning
    const spawns = this.room.find(FIND_MY_SPAWNS, {
      filter: s => !s.spawning
    });

    if (!spawns.length) return ERR_BUSY;

    const parts = XPARTS([CARRY, 4], [MOVE, 4]);
    const name = `Courier${Game.time}`;
    const res = spawns[0].spawnCreep(parts, name, {
      memory: {
        role: ResourceManager.roleCourier,
        origin: this.room.name
      }
    });

    if (res === OK) this.memory.courierNames.push(name);

    return res;
  }

  /**
   * Commands the creep to withdraw or harvest energy from managed resources.
   * Calling withdrawEnergy without options prioritizes storage and container
   * structures. If no viable storage or container structures are present, or
   * the ignoreStores option was specified, the creep is entered into a queue
   * used for managing access to the source nodes. If no amount is specified,
   * this function will attempt to fill the creep's free energy capacity.
   * @param creep - Creep instance requesting energy
   * @param opts - Options dictating how energy is obtained, and how much is obtained.
   * @returns Status code for energy withdraw process.
   */
  private withdrawEnergy(
    creep: Creep,
    opts?: WithdrawOpts
  ): utils.ResourceReturnCode {
    // For now, don't do anything if the creep is already harvesting or waiting.
    if (this.isCreepHarvesting(creep.id)) return utils.CREEP_ALREADY_HARVESTING;
    if (this.harvestQueue.containsCreep(creep.id))
      return utils.CREEP_IN_HARVEST_QUEUE;

    const usingStore = !opts || !opts.ignoreStores;
    const amount =
      opts && opts.amount && opts.amount > 0
        ? opts.amount
        : creep.store.getFreeCapacity(RESOURCE_ENERGY);

    if (usingStore) {
      // find first available storage unit or container with energy
      // move creep to this store
      const viableStorage = this.storageUnits.find(
        su => su.store[RESOURCE_ENERGY] > 0
      );
      if (viableStorage) {
        return ResourceManager.creepWithdrawFrom(
          creep,
          RESOURCE_ENERGY,
          viableStorage,
          amount
        );
      }
      const viableContainer = this.containers.find(
        c => c.store[RESOURCE_ENERGY] > 0
      );
      if (viableContainer) {
        return ResourceManager.creepWithdrawFrom(
          creep,
          RESOURCE_ENERGY,
          viableContainer,
          amount
        );
      }
    }

    // Check if this creep is already harvesting or waiting in the source queue
    // if not, enter creep into source queue.
    this.harvestQueue.enqueue([creep.id, amount]);

    return utils.CREEP_IN_HARVEST_QUEUE;
  }

  /**
   * Commands the creep to harvest from the target. If the target is not within
   * range, commands the creep to move toward the target. In the event that
   * the target does not have the specified amount of the resource, the creep
   * will be given what's available.
   * @param creep - Creep instance requesting resources.
   * @param type - Type of resource to withdraw.
   * @param target - Structure to withdraw from.
   * @param amount - Amount to withdraw.
   * @returns A code indicating the status of the withdraw.
   */
  private static creepWithdrawFrom<R extends ResourceConstant>(
    creep: Creep,
    type: R,
    target: Ruin | Tombstone | EnergyStructure | StoreStructure,
    amount?: number
  ): utils.ResourceReturnCode {
    let retCode: utils.ResourceReturnCode = utils.OK;

    switch (creep.withdraw(target, type, amount)) {
      case ERR_INVALID_ARGS:
        throw new Error(
          `ResourceManager.creepWithdrawFrom: type = ${type}, amount = ${
            amount || "undefined"
          }`
        );
      case ERR_INVALID_TARGET:
        throw new Error(
          `ResourceManager.creepWithdrawFrom: Was passed target incapable of containing ${type}`
        );
      case ERR_NOT_ENOUGH_RESOURCES:
        // Is this target of a type that has a store?
        if (isEnergyStructure(target))
          creep.withdraw(target, type, target.energy);
        else if (isStoreStructure(target))
          creep.withdraw(target, type, target.store[type]);
        break;
      case ERR_NOT_IN_RANGE:
        creep.moveTo(target, {
          visualizePathStyle: { stroke: palette.PATH_COLOR_HARVEST }
        });
        retCode = utils.MOVING_TO_TARGET;
        break;
      case OK:
      case ERR_NOT_OWNER:
      case ERR_BUSY:
      case ERR_FULL:
      default:
    }

    return retCode;
  }

  /**
   * Checks if any harvest positions are currently being occupied by a creep
   * with the given Id string.
   * @param creepId - Id string of a Creep instance.
   * @returns True if the creep is harvesting, otherwise False.
   */
  private isCreepHarvesting(creepId: Id<Creep>): boolean {
    let harvesting = false;

    for (const source of this.sources) {
      for (const pos of source.positions) {
        if (pos.occuiped && pos.occuiped.creepId === creepId) {
          harvesting = true;
          break;
        }
      }
    }

    return harvesting;
  }

  /**
   * Initializes the object within Memory.resources for this room, utlized
   * by the ResourceManager instance.
   */
  private init(): void {
    // Gather any containers or storage units in the room
    const containers = this.room
      .find(FIND_STRUCTURES, {
        filter: { structureType: STRUCTURE_CONTAINER }
      })
      .map(c => c as StructureContainer);
    const storageUnits = this.room
      .find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_STORAGE }
      })
      .map(s => s as StructureStorage);

    if (!this.memory) {
      const managedResources: ManagedStationMemory<Source>[] = [];

      // Gather energy sources and determine occupiable positions around them
      const sources = this.room.find(FIND_SOURCES);
      for (const source of sources) {
        const harvestPositions = ResourceManager.getOccupiablePositionsForSource(
          source
        );
        managedResources.push({
          roomName: this.room.name,
          stationId: source.id,
          positions: harvestPositions
        });
      }

      this.memory = {
        sources: managedResources,
        containers: containers.map(c => c.id),
        storageUnits: storageUnits.map(s => s.id),
        harvestQueue: [],
        deliveryQueue: [],
        courierNames: []
      };
    } else {
      // Refresh container and storage lists
      this.memory.containers = containers.map(c => c.id);
      this.memory.storageUnits = storageUnits.map(s => s.id);

      if (!this.memory.courierNames) this.memory.courierNames = [];
    }
  }

  /**
   * Get all occupiable positions bordering the given source.
   * @param source - A harvestable source.
   * @returns An array of occupiable positions.
   */
  private static getOccupiablePositionsForSource(
    source: Source
  ): OccupiablePosition[] {
    const positions: OccupiablePosition[] = [];
    const terrain = source.room.getTerrain();

    // Scan bordering spaces for occupiable positions
    for (let x = source.pos.x - 1; x <= source.pos.x + 1; x++) {
      for (let y = source.pos.y - 1; y <= source.pos.y + 1; y++) {
        // sources aren't walkable, so skip
        if (x === source.pos.x && y === source.pos.y) continue;

        // Look at space for any blockers or hazards
        const pos = new RoomPosition(x, y, source.room.name);
        const code = terrain.get(x, y);
        const road = pos
          .lookFor(LOOK_STRUCTURES)
          .filter(s => s.structureType === STRUCTURE_ROAD).length;
        const validPos =
          road ||
          ((code & TERRAIN_MASK_WALL) === 0 &&
            (code & TERRAIN_MASK_LAVA) === 0);

        if (validPos) positions.push({ x, y });
      }
    }

    return positions;
  }
}
