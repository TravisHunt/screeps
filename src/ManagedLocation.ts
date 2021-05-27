export default abstract class ManagedLocation {
  public abstract requestResources(): ResourceRequest[];

  protected static fillWithGameObjects<Type>(
    list: Type[],
    ids: Id<Type>[]
  ): void {
    for (const id of ids) {
      const obj = Game.getObjectById(id);
      if (obj) list.push(obj);
    }
  }

  protected static getIdsForObjectsInRange<Type extends AnyStructure>(
    pos: RoomPosition,
    range: number,
    structureType: BuildableStructureConstant
  ): Id<Type>[] {
    const objectsInRange = pos.findInRange(FIND_STRUCTURES, range, {
      filter: { structureType }
    }) as Type[];

    const objectIds = objectsInRange.map(c => c.id as Id<Type>);

    return objectIds;
  }
}
