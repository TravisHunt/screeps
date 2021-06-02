export default abstract class ManagedStation<Type extends RoomObject> {
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

  public get pos(): RoomPosition {
    return this.station.pos;
  }

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

  /**
   * Returns a list of positions adjacent to the station that could be added
   * to this station's list of occupiable positions. These positions were likely
   * no added when the station was initialized due to obstructions, such as
   * walls.
   * @remarks
   * This method returns undefined if not explictly overrided in the derived
   * station implementation. Override this if you want the derived station to
   * be considered for occupiable position expansion.
   * @returns List of RoomPositions
   */
  public findExpansionPositions(): RoomPosition[] | undefined {
    return undefined;
  }

  public static createMemoryObj<Type>(
    roomName: string,
    stationId: Id<Type>,
    positions: RoomPosition[]
  ): ManagedStationMemory<Type> {
    const mem: ManagedStationMemory<Type> = {
      roomName,
      stationId,
      positions
    };

    return mem;
  }

  public static getOccupiablePositions(
    pos: RoomPosition,
    roomName: string
  ): RoomPosition[] {
    const terrain = Game.rooms[roomName].getTerrain();
    const positions = ManagedStation.getAdjacentPositions(pos, roomName).filter(
      p => {
        const code = terrain.get(p.x, p.y);
        const hasRoad = p
          .lookFor(LOOK_STRUCTURES)
          .filter(s => s.structureType === STRUCTURE_ROAD).length;
        const validPos =
          hasRoad ||
          ((code & TERRAIN_MASK_WALL) === 0 &&
            (code & TERRAIN_MASK_LAVA) === 0);

        return validPos;
      }
    );

    return positions;
  }

  /**
   * Gets all positions adjacent to this room object.
   * @returns List of RoomPositions adjacent to the managed room object.
   */
  public static getAdjacentPositions(
    pos: RoomPosition,
    roomName: string,
    diagonals = true
  ): RoomPosition[] {
    const positions: RoomPosition[] = [];

    if (diagonals) {
      // Scan bordering spaces for occupiable positions
      for (let x = pos.x - 1; x <= pos.x + 1; x++) {
        for (let y = pos.y - 1; y <= pos.y + 1; y++) {
          // stations aren't walkable, so skip
          if (x === pos.x && y === pos.y) continue;
          // Don't include positions outside the bounds of the room
          if (x < 0 || x > 49 || y < 0 || y > 49) continue;

          const adj = new RoomPosition(x, y, roomName);
          positions.push(adj);
        }
      }
    } else {
      positions.push(new RoomPosition(pos.x - 1, pos.y, roomName));
      positions.push(new RoomPosition(pos.x + 1, pos.y, roomName));
      positions.push(new RoomPosition(pos.x, pos.y - 1, roomName));
      positions.push(new RoomPosition(pos.x, pos.y + 1, roomName));
    }

    return positions;
  }
}
