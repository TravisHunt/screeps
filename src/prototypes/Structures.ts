/**
 * Structure prototype additions
 */
declare global {
  interface Structure {
    isWalkable(): boolean;
  }
}

Structure.prototype.isWalkable = function () {
  return (
    this.structureType === STRUCTURE_ROAD ||
    this.structureType === STRUCTURE_CONTAINER ||
    (this.structureType === STRUCTURE_RAMPART &&
      ((this as StructureRampart).my || (this as StructureRampart).isPublic))
  );
};

export {};
