import { ROOM_AXIS } from "screeps.constants";
import { QUADRANT } from "utils/enums";

declare global {
  interface RoomPosition {
    quadrant(): number;
    inQuadrant(quadrant: number): boolean;
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

export {};
