import { ROOM_AXIS } from "screeps.constants";
import { QUADRANT } from "utils/enums";

declare global {
  interface RoomPosition {
    /**
     * Returns one of four quadrants depending on where this room position
     * lies within the room.
     */
    quadrant(): number;

    /**
     * Return true if this room position lies within the provided quadrant,
     * otherwise false.
     * @param quadrant - Quadrant query
     */
    inQuadrant(quadrant: number): boolean;

    /**
     * Generates a rectangle perimeter that encapsulates this RoomPosition and
     * any provided positions to be guarded. The perimeter has a default radius
     * of length range, and uses the guard positions to expand outward.
     * @param range - Base perimeter radius
     * @param guard - RoomPositions to include in perimeter
     */
    perimeter(range: number, guard: RoomPosition[]): Perimeter;

    /**
     * Returns true if this room position lies within the given perimeter.
     * @param perimeter - Rectangle perimeter object
     */
    inPerimeter(perimeter: Perimeter): boolean;

    /**
     * Finds a structure of the given type at this position if it exists.
     * @param type - Type of structure
     */
    lookForStructure(type: StructureConstant): Structure | undefined;

    findStructuresInRange(
      type: StructureConstant,
      range: number
    ): AnyStructure[];

    findMyStructuresInRange(
      type: StructureConstant,
      range: number
    ): AnyOwnedStructure[];

    distanceTo(to: RoomPosition): number;

    closest(...positions: RoomPosition[]): RoomPosition | undefined;

    isWalkable(): boolean;

    getAdjacent(diagonals?: boolean, walkable?: boolean): RoomPosition[];
  }
}

RoomPosition.prototype.quadrant = function () {
  // Position is in a quadrant
  if (this.x >= ROOM_AXIS) {
    // Position is in either quadrant 1 or 4
    return this.y >= ROOM_AXIS ? QUADRANT.I : QUADRANT.IV;
  } else {
    // Position is in either quadrant 2 or 3
    return this.y >= ROOM_AXIS ? QUADRANT.II : QUADRANT.III;
  }
};

RoomPosition.prototype.inQuadrant = function (quadrant) {
  switch (quadrant) {
    case QUADRANT.I:
      return this.x >= ROOM_AXIS && this.y >= ROOM_AXIS;
    case QUADRANT.II:
      return this.x < ROOM_AXIS && this.y >= ROOM_AXIS;
    case QUADRANT.III:
      return this.x < ROOM_AXIS && this.y < ROOM_AXIS;
    case QUADRANT.IV:
      return this.x >= ROOM_AXIS && this.y < ROOM_AXIS;
    default:
      console.log(`RoomPosition.inQuadrant: Invalid quadrant ${quadrant}`);
      return false;
  }
};

RoomPosition.prototype.perimeter = function (range, guard) {
  // Gather lower and upper bounds for the x and y axes.
  const guardSortedByX = guard.length ? guard.sort((a, b) => a.x - b.x) : [];
  const guardSortedByY = guard.length ? guard.sort((a, b) => a.y - b.y) : [];
  const xMin = guard.length
    ? Math.min(this.x - range, guardSortedByX[0].x)
    : this.x - range;
  const xMax = guard.length
    ? Math.max(this.x + range, guardSortedByX.reverse()[0].x)
    : this.x + range;
  const yMin = guard.length
    ? Math.min(this.y - range, guardSortedByY[0].y)
    : this.y - range;
  const yMax = guard.length
    ? Math.max(this.y + range, guardSortedByY.reverse()[0].y)
    : this.y + range;

  const perimeter: Perimeter = {
    x: { min: xMin, max: xMax },
    y: { min: yMin, max: yMax }
  };

  return perimeter;
};

RoomPosition.prototype.inPerimeter = function (perimeter) {
  return (
    this.x >= perimeter.x.min &&
    this.x <= perimeter.x.max &&
    this.y >= perimeter.y.min &&
    this.y <= perimeter.y.max
  );
};

RoomPosition.prototype.lookForStructure = function (type) {
  return _.find(this.lookFor(LOOK_STRUCTURES), s => s.structureType === type);
};

RoomPosition.prototype.findStructuresInRange = function (type, range) {
  return this.findInRange(FIND_STRUCTURES, range, {
    filter: { structureType: type }
  });
};

RoomPosition.prototype.findMyStructuresInRange = function (type, range) {
  return this.findInRange(FIND_MY_STRUCTURES, range, {
    filter: { structureType: type }
  });
};

RoomPosition.prototype.distanceTo = function (to) {
  const a = to.x - this.x;
  const b = to.y - this.y;

  return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2));
};

RoomPosition.prototype.closest = function (...positions) {
  if (!positions.length) return;

  let closest: RoomPosition | undefined;
  let smallestDistance = 0;

  for (const pos of positions) {
    const distance = this.distanceTo(pos);
    if (distance < smallestDistance) {
      closest = pos;
      smallestDistance = distance;
    }
  }

  return closest;
};

RoomPosition.prototype.isWalkable = function () {
  const blocked = this.lookFor(LOOK_STRUCTURES).find(s => !s.isWalkable());
  const walkable = this.lookFor(LOOK_STRUCTURES).find(s => s.isWalkable());
  const terrain = Game.rooms[this.roomName].getTerrain();
  const validTerrain =
    terrain.get(this.x, this.y) !== TERRAIN_MASK_WALL || !!walkable;

  return !blocked && validTerrain;
};

RoomPosition.prototype.getAdjacent = function (
  diagonals = true,
  walkable = false
) {
  const positions: RoomPosition[] = [];

  if (diagonals) {
    // Scan bordering spaces for occupiable positions
    for (let x = this.x - 1; x <= this.x + 1; x++) {
      for (let y = this.y - 1; y <= this.y + 1; y++) {
        // stations aren't walkable, so skip
        if (x === this.x && y === this.y) continue;
        // Don't include positions outside the bounds of the room
        if (x < 0 || x > 49 || y < 0 || y > 49) continue;

        const adj = new RoomPosition(x, y, this.roomName);

        if (walkable) {
          if (adj.isWalkable()) positions.push(adj);
        } else {
          positions.push(adj);
        }
      }
    }
  } else {
    positions.push(new RoomPosition(this.x - 1, this.y, this.roomName));
    positions.push(new RoomPosition(this.x + 1, this.y, this.roomName));
    positions.push(new RoomPosition(this.x, this.y - 1, this.roomName));
    positions.push(new RoomPosition(this.x, this.y + 1, this.roomName));
  }

  return positions;
};

export {};
