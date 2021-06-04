export default abstract class ManagerBase {
  protected room: Room;

  public constructor(room: Room) {
    this.room = room;
  }

  protected get roomState(): RoomState {
    return Memory.rooms[this.room.name].state;
  }

  public abstract run(): void;
}
