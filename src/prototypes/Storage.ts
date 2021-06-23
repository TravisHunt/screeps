/**
 * Storage prototype additions
 */
declare global {
  interface StructureStorage {
    energy(): number;
    empty(): boolean;
    full(): boolean;
    freeCapacity(type?: ResourceConstant): number;
    usedCapacity(type?: ResourceConstant): number;
  }
}

StructureStorage.prototype.energy = function () {
  return this.store[RESOURCE_ENERGY];
};

StructureStorage.prototype.empty = function () {
  return this.usedCapacity() === 0;
};

StructureStorage.prototype.full = function () {
  return this.freeCapacity() === 0;
};

StructureStorage.prototype.freeCapacity = function (type) {
  return this.store.getFreeCapacity(type);
};

StructureStorage.prototype.usedCapacity = function (type) {
  return this.store.getUsedCapacity(type);
};

export {};
