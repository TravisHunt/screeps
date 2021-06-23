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
    freeCapacity(type?: ResourceConstant): number;
    usedCapacity(type?: ResourceConstant): number;
    renewalCost(): number;
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

Creep.prototype.freeCapacity = function (type) {
  return this.store.getFreeCapacity(type);
};

Creep.prototype.usedCapacity = function (type) {
  return this.store.getUsedCapacity(type);
};

Creep.prototype.renewalCost = function () {
  const creepSize = this.body.length;
  const bodyCost = this.body
    .map(part => BODYPART_COST[part.type])
    .reduce((total, val) => total + val);
  const renewalCost = Math.ceil(bodyCost / 2.5 / creepSize);
  return renewalCost;
};

export {};
