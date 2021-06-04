export default abstract class ManagerBase {
  protected room: Room;
  protected memory: RoomMemory;

  public constructor(room: Room, memory: RoomMemory) {
    this.room = room;
    this.memory = memory;
  }

  public abstract run(): void;
}
