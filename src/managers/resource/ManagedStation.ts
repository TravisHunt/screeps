export default abstract class ManagedStation<Type> {
  protected station: Type;
  protected room: Room;
  protected _positions: OccupiablePosition[];

  public constructor(mem: ManagedStationMemory<Type>) {
    this._positions = mem.positions;
    this.room = Game.rooms[mem.roomName];

    const station = Game.getObjectById(mem.stationId);
    if (station) this.station = station;
    else throw new Error(`ManagedStation: no store with id ${mem.stationId}`);
  }

  public abstract run(): StationInsights;

  public get positions(): OccupiablePosition[] {
    return this._positions;
  }

  public get unoccupiedPositions(): OccupiablePosition[] {
    return this._positions.filter(p => !p.occuiped);
  }

  public get occupiedPositions(): OccupiedPosition[] {
    return this._positions.filter(p => p.occuiped) as OccupiedPosition[];
  }

  public get positionsInNeedOfRepair(): StructureRoad[] {
    const roadsToRepair: StructureRoad[] = [];

    for (const pos of this._positions) {
      const road = this.room
        .lookForAt(LOOK_STRUCTURES, pos.x, pos.y)
        .find(s => s.structureType === STRUCTURE_ROAD);

      // TODO: Define repair threshold constant
      if (road && road.hits < road.hitsMax * 0.75) {
        roadsToRepair.push(road as StructureRoad);
      }
    }

    return roadsToRepair;
  }

  public getAvailablePosition(): OccupiablePosition | undefined {
    for (const pos of this._positions) {
      if (!pos.occuiped) return pos;
    }
    return undefined;
  }
}
