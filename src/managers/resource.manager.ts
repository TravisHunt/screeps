import * as constants from "screeps.constants";
import ManagerBase from "managers/base.manager";
import { palette } from "path.palette";

export default class ResourceManager extends ManagerBase {
  private room: Room;
  private sources: Source[];
  private containers: StructureContainer[] = [];
  private storageUnits: StructureStorage[] = [];

  public constructor(room: Room) {
    super();
    this.room = room;

    this.init();

    this.sources = this.memory.sources.map(s => Game.getObjectById(s.sourceId) as Source);
    this.containers = this.memory.containers.map(id => Game.getObjectById(id) as StructureContainer);
    this.storageUnits = this.memory.storageUnits.map(id => Game.getObjectById(id) as StructureStorage);
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

  public run(): void {
    // Highlight occupiable resource positions while in debug mode
    if (constants.debug) {
      const visual = new RoomVisual(this.room.name);
      const positions = this.memory.sources.map(s => s.harvestPositions).reduce((acc, val) => acc.concat(val), []);
      for (const pos of positions) {
        visual.circle(pos.x, pos.y, { fill: "white", radius: 0.5 });
      }
    }
  }

  /**
   * Request a type of resource be loaded into the given creep. The resource
   * manager will provide what it can if the entire order cannot be filled.
   * If no amount is specified, the manager will attempt to fill the creep to
   * capacity.
   * @param creep The creep that needs the resource
   * @param type The type of resource being requested
   * @param opts Optional values for withdraw request
   * @returns A code indicating the status of the withdraw request
   */
  public withdraw<R extends ResourceConstant>(creep: Creep, type: R, opts?: WithdrawOpts): ResourceManagerReturnCode {
    switch (type) {
      case RESOURCE_ENERGY:
        return this.withdrawEnergy(creep, opts);
      default:
        return RM_ERR_RESOURCE_NOT_IMPLEMENTED;
    }
  }

  private withdrawEnergy(creep: Creep, opts?: WithdrawOpts): ResourceManagerReturnCode {
    const usingStore = !opts || !opts.ignoreStores;
    const amount = opts && opts.amount && opts.amount > 0 ? opts.amount : creep.store.getFreeCapacity();

    if (usingStore) {
      // find first available storage unit or container with energy
      // move creep to this store
      const viableStorage = this.storageUnits.find(su => su.store[RESOURCE_ENERGY] > amount);
      if (viableStorage) return ResourceManager.creepWithdrawFrom(creep, RESOURCE_ENERGY, viableStorage, amount);
      const viableContainer = this.containers.find(c => c.store[RESOURCE_ENERGY] > amount);
      if (viableContainer) return ResourceManager.creepWithdrawFrom(creep, RESOURCE_ENERGY, viableContainer, amount);
    }

    // check if this creep is already waiting in the source queue
    // if not, enter creep into source queue.

    return RM_ERR_RESOURCE_NOT_IMPLEMENTED;
  }

  private static creepWithdrawFrom<R extends ResourceConstant>(
    creep: Creep,
    type: R,
    target: Structure<StructureConstant>,
    amount?: number
  ): ResourceManagerReturnCode {
    // let retCode: ResourceManagerReturnCode = RM_OK;

    if (creep.withdraw(target, type, amount) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { visualizePathStyle: { stroke: palette.harvest } });
      // retCode = RM_MOVING_TO_TARGET;
    }

    return 0;
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
        const harvestPositions = ResourceManager.getOccupiablePositionsForSource(source);
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
        storageUnits: storageUnits.map(s => s.id)
      };
    }
  }

  /**
   * Get all occupiable positions bordering the given source.
   * @param source A harvestable source
   * @returns An array of occupiable positions
   */
  private static getOccupiablePositionsForSource(source: Source): OccupiablePosition[] {
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
        const road = pos.lookFor(LOOK_STRUCTURES).filter(s => s.structureType === STRUCTURE_ROAD).length;
        const validPos = road || ((code & TERRAIN_MASK_WALL) === 0 && (code & TERRAIN_MASK_LAVA) === 0);

        if (validPos) positions.push({ x, y, occuiped: false });
      }
    }

    return positions;
  }
}
