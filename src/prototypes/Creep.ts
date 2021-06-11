/**
 * Creep prototype additions
 */
declare global {
  interface Creep {
    /**
     * Returns true if this creep is currently within one of my ramparts.
     */
    inRampart(): boolean;
  }
}

Creep.prototype.inRampart = function () {
  return !!this.pos.lookForStructure(STRUCTURE_RAMPART);
};

export {};
