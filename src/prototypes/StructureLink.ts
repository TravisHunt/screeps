/**
 * StructureLink prototype additions
 */
declare global {
  interface StructureLink {
    /** Shorthand for link.cooldown === 0 */
    ready(): boolean;
    /** Shorthand for link.store.getFreeCapacity(RESOURCE_ENERGY) */
    freeCapacity(): number;
    /** Shorthand for link.store.getUsedCapacity(RESOURCE_ENERGY) */
    usedCapacity(): number;
    /** Shorthand for link.store.getFreeCapacity(RESOURCE_ENERGY) === 0 */
    full(): boolean;
    /** Shorthand for link.store.getUsedCapacity(RESOURCE_ENERGY) === 0 */
    empty(): boolean;
  }
}

StructureLink.prototype.ready = function () {
  return this.cooldown === 0;
};

StructureLink.prototype.freeCapacity = function () {
  return this.store.getFreeCapacity(RESOURCE_ENERGY);
};

StructureLink.prototype.usedCapacity = function () {
  return this.store.getUsedCapacity(RESOURCE_ENERGY);
};

StructureLink.prototype.full = function () {
  return this.freeCapacity() === 0;
};

StructureLink.prototype.empty = function () {
  return this.usedCapacity() === 0;
};

export {};
