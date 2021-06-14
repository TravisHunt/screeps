import IRunnable from "interfaces/IRunnable";

export default class StatisticsService implements IRunnable {
  private static instance: StatisticsService;

  private get stats(): IStatistics {
    return Memory.statistics;
  }
  private set stats(stats: IStatistics) {
    Memory.statistics = stats;
  }

  private constructor() {
    // Create statistics memory object if it does not yet exist
    if (!this.stats) {
      this.stats = StatisticsService.createMemory();
    }
    // Ensure we capture all visible rooms
    for (const roomName in Game.rooms) {
      if (roomName in this.stats.rooms === false) {
        this.stats.rooms[roomName] = StatisticsService.createRoomMemory(
          Game.rooms[roomName]
        );
      }
    }
  }

  private static createMemory(): IStatistics {
    return { rooms: {} };
  }

  private static createRoomMemory(room: Room): IRoomStatistics {
    const stats: IRoomStatistics = { roomName: room.name, storage: {} };

    const storages = room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_STORAGE
    }) as StructureStorage[];

    for (const storage of storages) {
      stats.storage[storage.id] = {} as IStorageStatistics;
      stats.storage[storage.id].resource = {} as ResourceStats;
    }

    return stats;
  }

  public static getInstance(): StatisticsService {
    if (!StatisticsService.instance) {
      StatisticsService.instance = new StatisticsService();
    }
    return StatisticsService.instance;
  }

  public run(): void {
    // Not yet implemented
  }

  public logStorageWithdraw(
    storage: StructureStorage,
    role: string,
    resource: ResourceConstant,
    amount: number
  ): void {
    let errmsg: string | undefined;
    if (storage.room.name in this.stats.rooms === false) {
      errmsg = `${storage.room.name} does not exist in Memory.statistics.rooms`;
    } else if (
      storage.id in this.stats.rooms[storage.room.name].storage ===
      false
    ) {
      errmsg = `Storage ${storage.id} not in ${storage.room.name} room stats`;
    }

    if (errmsg) {
      console.log(errmsg);
      return;
    }

    const storageStat = this.stats.rooms[storage.room.name].storage[storage.id];

    if (resource in storageStat.resource === false) {
      storageStat.resource[resource] = {};
    }
    if (role in storageStat.resource[resource] === false) {
      storageStat.resource[resource][role] = { in: 0, out: 0 };
    }

    storageStat.resource[resource][role].out += amount;
  }
}
