interface IRoomObject {
  /**
   * Applied effects, an array of objects with the following properties:
   */
  readonly effects: RoomObjectEffect[];
  /**
   * An object representing the position of this object in the room.
   */
  readonly pos: RoomPosition;
  /**
   * The link to the Room object. May be undefined in case if an object is a
   * flag or a construction site and is placed in a room that is not visible
   * to you.
   */
  readonly room: Room | undefined;
}
