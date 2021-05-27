import ManagerBase from "managers/base.manager";
import ResourceManager from "managers/resource/resource.manager";
import { OUTPOST_NAME_PREFIX, OUTPOST_RANGE, debug } from "screeps.constants";
import Outpost from "./Outpost";

export default class OutpostManager extends ManagerBase {
  public outposts: Outpost[] = [];
  private resourceManager: ResourceManager;

  private get memory(): OutpostManagerMemory {
    return Memory.outposts[this.room.name];
  }

  public constructor(
    mem: OutpostManagerMemory,
    room: Room,
    resourceManager: ResourceManager
  ) {
    super(room);
    this.resourceManager = resourceManager;
    if (mem.outposts && mem.outposts.length)
      this.outposts = mem.outposts.map(o => Outpost.getInstance(o));
  }

  public run(): void {
    // Look for new outpost flags
    const outpostFlags = this.room.find(FIND_FLAGS, {
      filter: flag => flag.name.startsWith(OUTPOST_NAME_PREFIX)
    });

    // For each outpost flag found, check if we're tracking this outpost.
    // TODO: What happens if an outpost flag is removed?
    for (const flag of outpostFlags) {
      const exists = this.memory.outposts.find(o => o.name === flag.name);
      if (!exists) {
        // Save new outpost to memory and run-time list
        const newOutpostMemory = Outpost.createMemory(flag, OUTPOST_RANGE);
        this.memory.outposts.push(newOutpostMemory);
        this.outposts.push(Outpost.getInstance(newOutpostMemory));
      }
    }

    // Rescan outpost area for newly built/destroyed structures
    this.outposts.forEach(o => o.rescan());

    // Submit resource requests from outposts to resource manager
    const requests = this.outposts
      .map(o => o.requestResources())
      .reduce((acc, val) => acc.concat(val), []);

    this.resourceManager.acceptResourceRequests(requests);

    // Draw outpost debug overlay for each outpost
    if (debug) {
      const visual = new RoomVisual(this.room.name);
      for (const outpost of this.outposts) {
        visual.rect(
          outpost.base.x - outpost.range,
          outpost.base.y - outpost.range,
          outpost.range * 2,
          outpost.range * 2,
          {
            fill: "transparent",
            stroke: "white",
            lineStyle: "dashed"
          }
        );
      }
    }
  }
}
