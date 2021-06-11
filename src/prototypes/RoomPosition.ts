import { ROOM_AXIS } from "screeps.constants";
import { QUADRANT } from "utils/enums";

declare global {
  interface RoomPosition {
    quadrant(): number;
    inQuadrant(quadrant: number): boolean;

    /**
     * Generates a rectangle perimeter that encapsulates this RoomPosition and
     * any provided positions to be guarded. The perimeter has a default radius
     * of length range, and uses the guard positions to expand outward.
     * @param range - Base perimeter radius
     * @param guard - RoomPositions to include in perimeter
     */
    perimeter(range: number, guard: RoomPosition[]): Perimeter;
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

export {};