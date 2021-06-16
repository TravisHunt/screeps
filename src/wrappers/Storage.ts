import OwnedStructureWrapper from "./OwnedStructureWrapper";

export default class Storage extends OwnedStructureWrapper<StructureStorage> {
  public constructor(storage: StructureStorage) {
    super(storage);
  }

  public get store(): StoreDefinition {
    return this._target.store;
  }

  public full(): boolean {
    return this.store.getUsedCapacity() === this.store.getCapacity();
  }
}
