export default class Build {
  public id: number;
  public type: BuildType;
  public room: Room;
  public sites: ConstructionSite[] = [];
  public positions: RoomPosition[];
  public complete: boolean;
  private roomName: string;
  private siteIds: Id<ConstructionSite>[];

  public static generateBuildId(positions: RoomPosition[]): number {
    // Convert room positions into a string by converting the x and y values
    // into characters.
    const prehash = positions.map(p => `${p.x}${p.y}`).join("");
    const hash = Build.hashPositionString(prehash);
    return hash;
  }

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

  public static createMemoryInstance(
    type: BuildType,
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

  public constructor(mem: BuildMemory) {
    if (!mem.id) throw new Error("Build object missing id");
    if (!mem.roomName) throw new Error(`Build ${mem.id} missing room`);
    if (!mem.positions.length)
      throw new Error(`Build ${mem.id} missing coordinates`);

    this.id = mem.id;
    this.type = mem.type;
    this.roomName = mem.roomName;
    this.room = Game.rooms[this.roomName];
    this.complete = mem.complete;
    this.siteIds = mem.siteIds;
    this.positions = mem.positions.map(
      loc => new RoomPosition(loc.x, loc.y, this.room.name)
    );

    // If we don't have a list of construction site ids, then this job hasn't
    // been worked on since it was submitted. We need to find the construction
    // sites at the coordinates within mem.siteLocations.
    if (!this.siteIds.length) {
      for (const pos of this.positions) {
        const site = this.room.lookForAt(LOOK_CONSTRUCTION_SITES, pos).shift();
        if (site) mem.siteIds.push(site.id);
      }
    }

    if (mem.siteIds.length !== this.positions.length) {
      const log = `ERROR: Build ${mem.id} | ${this.positions.length} site \
      locations and ${mem.siteIds.length} construction sites found.`;
      Memory.logs.push(log);
      console.log(log);
    }

    // If construction sites have been built, they won't show up here, which
    // is fine, because we only want builders to access lives sites.
    for (const id of this.siteIds) {
      const csite = Game.getObjectById(id);
      if (csite) this.sites.push(csite);
    }

    // If we find no construction sites, we can assume the build is complete.
    if (!this.sites.length) this.complete = true;
  }
}
