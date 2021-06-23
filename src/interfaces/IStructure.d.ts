interface IStructure extends IRoomObject {
  readonly hits: number;
  readonly hitsMax: number;
  readonly structureType: StructureConstant;

  destroy(): ScreepsReturnCode;
  isActive(): boolean;
  isWalkable(): boolean;
  notifyWhenAttacked(enabled: boolean): ScreepsReturnCode;
}
