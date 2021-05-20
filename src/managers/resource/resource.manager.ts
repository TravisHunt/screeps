import * as constants from "screeps.constants";
import * as utils from "./utils";
import ManagerBase from "managers/base.manager";
import HarvestQueue from "./HarvestQueue";
import * as palette from "palette";
import {
  EnergyStructure,
  StoreStructure,
  isEnergyStructure,
  isStoreStructure
} from "utils/typeGuards";

export default class ResourceManager extends ManagerBase {
  private room: Room;
  private sources: Source[];
  private containers: StructureContainer[] = [];
  private storageUnits: StructureStorage[] = [];
  private harvestQueue: HarvestQueue;

  public constructor(room: Room) {
    super();
    this.room = room;

    this.init();

    this.sources = this.memory.sources.map(
      s => Game.getObjectById(s.sourceId) as Source
    );
    this.containers = this.memory.containers.map(
      id => Game.getObjectById(id) as StructureContainer
    );
    this.storageUnits = this.memory.storageUnits.map(
      id => Game.getObjectById(id) as StructureStorage
    );
    this.harvestQueue = new HarvestQueue(this.memory.harvestQueue || []);
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

  private get firstAvailableHarvestPosition(): OccupiablePosition | undefined {
    for (const managed of this.memory.sources) {
      for (const position of managed.harvestPositions) {
        if (!position.occuiped) return position;
      }
    }

    return undefined;
  }

  public run(): void {
    // Run harvest jobs for creeps occupying harvest positions
    // Clear occupied spaces where the occupier is done harvesting
    for (const managedSource of this.memory.sources) {
      const source = this.sources.find(s => s.id === managedSource.sourceId);
      if (!source) throw new Error(`Missing source: ${managedSource.sourceId}`);

      for (const slot of managedSource.harvestPositions) {
        if (slot.occuiped) {
          const creep = Game.getObjectById(slot.occuiped.creepId);

          // If Game doesn't give us a creep, assume it's dead and clear
          // the harvest position.
          if (!creep) {
            slot.occuiped = undefined;
            continue;
          }

          // Check harvest job progress. If we're done, clear out the slot
          // so it can be reassigned.
          slot.occuiped.progress =
            creep.store.getUsedCapacity(RESOURCE_ENERGY) - slot.occuiped.start;
          if (slot.occuiped.progress >= slot.occuiped.requested) {
            // Harvest job is done. Clear out position.
            slot.occuiped = undefined;
          } else {
            // Has the creep made it to their assigned harvest position?
            if (creep.pos.isEqualTo(slot.x, slot.y)) {
              // Continue harvesting for this tick
              creep.harvest(source);
            } else {
              // Move to the harvest position using the serialized path string
              // generated when the harvest position was assigned.
              creep.moveByPath(slot.occuiped.path);
            }
          }
        }
      }
    }

    // Assign unoccupied harvest positions to creeps waiting in the queue
    if (this.harvestQueue.length) {
      // Get the number of unoccupied harvest positions
      const unoccupied = this.memory.sources
        .map(s => s.harvestPositions)
        .reduce((acc, val) => acc.concat(val), [])
        .filter(pos => !pos.occuiped).length;

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
        if (this.firstAvailableHarvestPosition) {
          const pos = new RoomPosition(
            this.firstAvailableHarvestPosition.x,
            this.firstAvailableHarvestPosition.y,
            this.room.name
          );
          this.firstAvailableHarvestPosition.occuiped = {
            creepId: harvestRequest[0],
            requested: harvestRequest[1],
            start: creep.store.getUsedCapacity(RESOURCE_ENERGY),
            progress: 0,
            path: Room.serializePath(creep.pos.findPathTo(pos))
          };

          assignmentsComplete++;
        } else {
          throw new Error(
            "No available harvest positions when one was expected"
          );
        }
      }
    }

    // TODO: perform any necessary end-of-tick clean up
    // Save updated harvest queue to memory
    this.memory.harvestQueue = this.harvestQueue.queue;

    // Highlight occupiable resource positions while in debug mode
    if (constants.debug) {
      const visual = new RoomVisual(this.room.name);
      const positions = this.memory.sources
        .map(s => s.harvestPositions)
        .reduce((acc, val) => acc.concat(val), []);
      for (const pos of positions) {
        const color = pos.occuiped
          ? palette.HARVEST_POS_OCCUPIED
          : palette.HARVEST_POS;
        visual.circle(pos.x, pos.y, { fill: color, radius: 0.5 });
      }
    }
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
    switch (type) {
      case RESOURCE_ENERGY:
        return this.withdrawEnergy(creep, opts);
      default:
        return utils.ERR_RESOURCE_NOT_IMPLEMENTED;
    }
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
    const usingStore = !opts || !opts.ignoreStores;
    const amount =
      opts && opts.amount && opts.amount > 0
        ? opts.amount
        : creep.store.getFreeCapacity(RESOURCE_ENERGY);

    if (constants.debug) {
      console.log(
        `Creep: ${creep.id}, usingStore: ${
          usingStore ? "YES" : "NO"
        }, amount: ${amount}`
      );
    }

    if (usingStore) {
      // find first available storage unit or container with energy
      // move creep to this store
      const viableStorage = this.storageUnits.find(
        su => su.store[RESOURCE_ENERGY] > amount
      );
      if (viableStorage)
        return ResourceManager.creepWithdrawFrom(
          creep,
          RESOURCE_ENERGY,
          viableStorage,
          amount
        );
      const viableContainer = this.containers.find(
        c => c.store[RESOURCE_ENERGY] > amount
      );
      if (viableContainer)
        return ResourceManager.creepWithdrawFrom(
          creep,
          RESOURCE_ENERGY,
          viableContainer,
          amount
        );
    }

    // Check if this creep is already harvesting or waiting in the source queue
    // if not, enter creep into source queue.
    if (
      !this.isCreepHarvesting(creep.id) &&
      !this.harvestQueue.containsCreep(creep.id)
    ) {
      const count = this.harvestQueue.enqueue([creep.id, amount]);
      if (constants.debug) console.log(`Queue length: ${count}`);
    }

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

    for (const source of this.memory.sources) {
      for (const pos of source.harvestPositions) {
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
    if (!this.memory) {
      const managedResources: ManagedResource[] = [];

      // Gather energy sources and determine occupiable positions around them
      const sources = this.room.find(FIND_SOURCES);
      for (const source of sources) {
        const harvestPositions = ResourceManager.getOccupiablePositionsForSource(
          source
        );
        managedResources.push({ sourceId: source.id, harvestPositions });
      }

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

      this.memory = {
        sources: managedResources,
        containers: containers.map(c => c.id),
        storageUnits: storageUnits.map(s => s.id),
        harvestQueue: []
      };
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
