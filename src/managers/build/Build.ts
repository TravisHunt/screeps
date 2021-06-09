/**
 * A model to represent a group of construction sites as a unit.
 */
export default class Build {
  public id: number;
  public type: BuildableStructureConstant;
  public room: Room;
  public sites: ConstructionSite[] = [];
  public positions: RoomPosition[];
  public complete: boolean;

  /**
   * Generates an id values by using a simple hashing function on the
   * coordinates of the construction sites.
   * @param positions - Construction site positions
   * @returns Id hash
   */
  public static generateBuildId(positions: RoomPosition[]): number {
    // Convert room positions into a string by converting the x and y values
    // into characters.
    const prehash = positions.map(p => `${p.x}${p.y}`).join("");
    const hash = Build.hashPositionString(prehash);
    return hash;
  }

  /**
   * Simple hash function to convert a string to a hashed number
   * @param posStr - String to hash
   * @returns hash
   */
  private static hashPositionString(posStr: string): number {
    let hash = 0;
    if (!posStr.length) return hash;

    for (let i = 0; i < posStr.length; i++) {
      const char = posStr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = ~hash;
    }

    return hash;
  }

  /**
   * Creates a new memory object for the Build model.
   * @param type - Type of structure being built at sites
   * @param roomName - Build's room name
   * @param positions - List of RoomPositions where there are construction sites
   * @returns Memory object for Build model
   */
  public static createMemoryInstance(
    type: BuildableStructureConstant,
    roomName: string,
    positions: RoomPosition[]
  ): BuildMemory {
    const memory = {
      id: Build.generateBuildId(positions),
      type,
      roomName,
      siteIds: [],
      positions,
      complete: false
    };

    return memory;
  }

  /**
   * A model to represent a group of construction sites as a unit.
   */
  public constructor(mem: BuildMemory) {
    if (!mem.id) throw new Error("Build object missing id");
    if (!mem.roomName) throw new Error(`Build ${mem.id} missing room`);
    if (!mem.positions.length)
      throw new Error(`Build ${mem.id} missing coordinates`);

    this.id = mem.id;
    this.type = mem.type;
    this.room = Game.rooms[mem.roomName];
    this.complete = mem.complete;
    this.positions = mem.positions.map(
      loc => new RoomPosition(loc.x, loc.y, this.room.name)
    );

    // If we don't have a list of construction site ids, then this job hasn't
    // been worked on since it was submitted. We need to find the construction
    // sites at the coordinates within mem.siteLocations.
    if (!mem.siteIds.length) {
      for (const pos of this.positions) {
        const site = this.room.lookForAt(LOOK_CONSTRUCTION_SITES, pos).shift();
        if (site) mem.siteIds.push(site.id);
      }
    }

    // If construction sites have been built, they won't show up here, which
    // is fine, because we only want builders to access lives sites.
    for (const id of mem.siteIds) {
      const csite = Game.getObjectById(id);
      if (csite) this.sites.push(csite);
    }

    // If we find no construction sites, we can assume the build is complete.
    if (!this.sites.length) {
      mem.complete = true;
      this.complete = true;
    }
  }
}
