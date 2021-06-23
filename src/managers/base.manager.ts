import SourceService2 from "services/SourceService2";
import SpawnService from "services/SpawnService";
import StorageService from "services/StorageService";

export default abstract class ManagerBase {
  protected room: Room;
  protected memory: RoomMemory;
  protected sourceService: SourceService2;
  protected spawnService: SpawnService;
  protected storageService: StorageService;

  public constructor(room: Room, memory: RoomMemory) {
    this.room = room;
    this.memory = memory;
    this.sourceService = SourceService2.getInstance();
    this.spawnService = SpawnService.getInstance();
    this.storageService = StorageService.getInstance();
  }

  public abstract run(): void;
}
