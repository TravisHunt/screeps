export default abstract class RoomObjectWrapper<T extends RoomObject>
  implements IRoomObject {
  protected target: T;

  public constructor(target: T) {
    this.target = target;
  }

  public get effects(): RoomObjectEffect[] {
    return this.target.effects;
  }
  public get pos(): RoomPosition {
    return this.target.pos;
  }
  public get room(): Room | undefined {
    return this.target.room;
  }
}
