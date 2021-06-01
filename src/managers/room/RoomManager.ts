import HarvestManager from "managers/harvest.manager";
import ManagedStation from "managers/resource/ManagedStation";
import ResourceService from "services/ResourceService";

export default class RoomManager {
  public room: Room;
  public spawns: StructureSpawn[];
  private resourceService: ResourceService;
  // private harvesterManager: HarvestManager;

  private get memory(): RoomMemory {
    return Memory.rooms[this.room.name];
  }
  private set memory(mem: RoomMemory) {
    Memory.rooms[this.room.name] = mem;
  }

  public constructor(roomName: string) {
    if (roomName in Game.rooms === false) {
      throw new RoomNotFoundError(`${roomName} not found in Game.rooms`);
    }

    this.room = Game.rooms[roomName];

    // Construct a new memory object if this is the first time we're tracking
    // this room.
    if (!this.memory) {
      this.memory = RoomManager.createRoomMemoryObj();
    }

    // Rescan for sources and store structures
    this.refreshSourcesAndStores();

    // Build from stored ids
    this.spawns = this.memory.spawnIds.map(
      id => Game.getObjectById(id) as StructureSpawn
    );

    // Init managed memory for sources
    if (this.memory.managedSources.length !== this.memory.sourceIds.length) {
      this.initManagedSources();
    }

    // Init service for managing access to source harvesting
    this.resourceService = new ResourceService(
      this.room,
      this.memory.managedSources,
      this.memory.harvestQueue
    );
  }

  public run(): void {
    this.resourceService.run();
  }

  private static createRoomMemoryObj(): RoomMemory {
    return {
      state: {
        spawnAdjacentWalkways: { inprogress: false, complete: false },
        roadFromSpawnToCtrl: { inprogress: false, complete: false },
        roadFromSpawnToEnergySources: { inprogress: false, complete: false },
        sourceQueueRoad: { inprogress: false, complete: false },
        outpostRoads: {}
      },

      buildQueue: [],

      harvestQueue: [],
      deliveryQueue: [],
      courierNames: [],

      managedSources: [],

      spawnIds: [],
      sourceIds: [],
      containerIds: [],
      storageIds: [],
      terminalIds: [],

      outposts: {}
    };
  }

  private refreshSourcesAndStores(): void {
    this.memory.sourceIds = this.room.find(FIND_SOURCES).map(s => s.id);

    const structures = this.room.find(FIND_STRUCTURES);

    this.memory.spawnIds = structures
      .filter(s => s.structureType === STRUCTURE_SPAWN)
      .map(s => s.id as Id<StructureSpawn>);

    this.memory.containerIds = structures
      .filter(s => s.structureType === STRUCTURE_CONTAINER)
      .map(s => s.id as Id<StructureContainer>);

    this.memory.storageIds = structures
      .filter(s => s.structureType === STRUCTURE_STORAGE)
      .map(s => s.id as Id<StructureStorage>);

    this.memory.terminalIds = structures
      .filter(s => s.structureType === STRUCTURE_TERMINAL)
      .map(s => s.id as Id<StructureTerminal>);
  }

  private initManagedSources(): void {
    this.memory.managedSources = [];

    const sources = this.memory.sourceIds.map(
      id => Game.getObjectById(id) as Source
    );

    for (const src of sources) {
      this.memory.sourceIds.push(src.id);

      const positions = ManagedStation.getOccupiablePositions(
        src.pos,
        this.room.name
      );

      // Create memory object for managed source
      const mem = ManagedStation.createMemoryObj(
        this.room.name,
        src.id,
        positions
      );

      this.memory.managedSources.push(mem);
    }
  }
}
