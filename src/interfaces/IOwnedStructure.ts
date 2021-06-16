export default interface IOwnedStructure {
  readonly effects: RoomObjectEffect[];
  readonly pos: RoomPosition;
  readonly room: Room;
  readonly hits: number;
  readonly hitsMax: number;
  readonly structureType: StructureConstant;
  readonly my: boolean;
  readonly owner: Owner | undefined;

  destroy(): ScreepsReturnCode;
  isActive(): boolean;
  isWalkable(): boolean;
  notifyWhenAttacked(enabled: boolean): ScreepsReturnCode;
}
