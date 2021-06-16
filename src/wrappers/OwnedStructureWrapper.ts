import IOwnedStructure from "interfaces/IOwnedStructure";

export default abstract class OwnedStructureWrapper<T extends OwnedStructure>
  implements IOwnedStructure {
  protected _target: T;

  public constructor(structure: T) {
    this._target = structure;
  }

  public get target(): T {
    return this._target;
  }
  public get id(): Id<T> {
    return this._target.id;
  }
  public get effects(): RoomObjectEffect[] {
    return this._target.effects;
  }
  public get pos(): RoomPosition {
    return this._target.pos;
  }
  public get room(): Room {
    return this._target.room;
  }
  public get hits(): number {
    return this._target.hits;
  }
  public get hitsMax(): number {
    return this._target.hitsMax;
  }
  public get structureType(): StructureConstant {
    return this._target.structureType;
  }
  public get my(): boolean {
    return this._target.my;
  }
  public get owner(): Owner | undefined {
    return this._target.owner;
  }

  public destroy(): ScreepsReturnCode {
    return this._target.destroy();
  }
  public isActive(): boolean {
    return this._target.isActive();
  }
  public isWalkable(): boolean {
    return this._target.isWalkable();
  }
  public notifyWhenAttacked(enabled = true): ScreepsReturnCode {
    return this._target.notifyWhenAttacked(enabled);
  }
}
