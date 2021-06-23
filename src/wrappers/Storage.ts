import OwnedStructureWrapper from "./OwnedStructureWrapper";

/**
 * Wrapper class for StructureStorage instances.
 */
export default class Storage extends OwnedStructureWrapper<StructureStorage> {
  private static readonly reserveThreshold = 100000;
  public constructor(storage: StructureStorage) {
    super(storage);
  }

  public get obj(): StructureStorage {
    return this._target;
  }

  public get store(): StoreDefinition {
    return this._target.store;
  }

  public energy(): number {
    return this.obj.energy();
  }

  public empty(): boolean {
    return this.obj.empty();
  }

  public full(): boolean {
    return this.obj.full();
  }

  public reservesMet(): boolean {
    return this.energy() >= Storage.reserveThreshold;
  }
}
