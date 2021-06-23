/**
 * Wrapper class for a RoomPosition adjacent to a Source. These positions
 * can be locked by harvesters, so that only the harvester has access to the
 * tile while it is harvesting from the Source.
 */
export default class HarvestPosition
  extends RoomPosition
  implements IHarvestPosition {
  public locked: boolean;
  public sourceId: Id<Source>;

  public constructor(
    x: number,
    y: number,
    roomName: string,
    sourceId: Id<Source>,
    locked = false
  ) {
    super(x, y, roomName);
    this.sourceId = sourceId;
    this.locked = locked;
  }
}
