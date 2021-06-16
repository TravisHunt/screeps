/**
 * Creep prototype additions
 */
declare global {
  interface Creep {
    /**
     * Returns true if this creep is currently within one of my ramparts.
     */
    inRampart(): boolean;
    energy(): number;
    energyCapacity(): number;
  }
}

Creep.prototype.inRampart = function () {
  return !!this.pos.lookForStructure(STRUCTURE_RAMPART);
};

Creep.prototype.energy = function () {
  return this.store.getUsedCapacity(RESOURCE_ENERGY);
};

Creep.prototype.energyCapacity = function () {
  return this.store.getCapacity(RESOURCE_ENERGY);
};

export {};
