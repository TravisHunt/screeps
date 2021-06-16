import IRunnable from "interfaces/IRunnable";
import Storage from "wrappers/Storage";

type StorageTree = Record<string, Record<string, Storage>>;

export default class StorageService implements IRunnable {
  private static instance: StorageService;
  private storage: StorageTree = {};

  private get memory(): StorageServiceMemory {
    return Memory.storageService;
  }
  private set memory(mem: StorageServiceMemory) {
    Memory.storageService = mem;
  }

  private static createMemory(): StorageServiceMemory {
    return {};
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private constructor() {
    if (!this.memory) this.memory = StorageService.createMemory();
  }

  public run(): void {
    this.refresh();
  }

  public refresh(): void {
    // Ensure we capture all rooms with storage units
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.my()) {
        if (room.name in this.memory === false) this.addRoom(room);
        this.refreshCollectionForRoom(room);
      }
    }
  }

  public getNearestStorage(
    pos: RoomPosition,
    requireSpace = true
  ): Storage | undefined {
    let toReturn: Storage | undefined;
    if (pos.roomName in this.storage) {
      let minDistance = 99;
      for (const id in this.storage[pos.roomName]) {
        const storage = this.storage[pos.roomName][id];
        if (requireSpace && storage.full()) continue;
        const dist = storage.pos.distanceTo(pos);
        if (dist < minDistance) {
          minDistance = dist;
          toReturn = storage;
        }
      }
    }
    return toReturn;
  }

  private addRoom(room: Room): void {
    this.memory[room.name] = [];
  }

  private refreshCollectionForRoom(room: Room): void {
    // Let's make sure our storage ids still map to storage units. It's
    // possible that a unit was destroyed.
    const storage = room.findMyStructures(
      STRUCTURE_STORAGE
    ) as StructureStorage[];

    // Refresh id collection
    this.memory[room.name] = storage.map(s => s.id);
    // Add instances to list for room
    this.storage[room.name] = {};
    for (const s of storage) {
      this.storage[room.name][s.id] = new Storage(s);
    }
  }
}
