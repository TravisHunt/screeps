export default abstract class ManagerBase {
  protected room: Room;

  public constructor(room: Room) {
    this.room = room;
  }

  protected get roomState(): RoomState {
    return Memory.roomState[this.room.name];
  }

  public abstract run(): void;
}
