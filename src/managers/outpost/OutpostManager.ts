import { OUTPOST_NAME_PREFIX, OUTPOST_RANGE, debug } from "screeps.constants";
import DeliveryService from "services/DeliveryService";
import Outpost from "./Outpost";

export default class OutpostManager {
  public room: Room;
  public outposts: Record<string, Outpost> = {};
  private memory: RoomMemory;
  private deliveryService: DeliveryService;

  public constructor(
    room: Room,
    memory: RoomMemory,
    outposts: Record<string, Outpost>,
    resourceService: DeliveryService
  ) {
    this.room = room;
    this.memory = memory;
    this.outposts = outposts;
    this.deliveryService = resourceService;
  }

  public run(): void {
    // Look for new outpost flags
    const outpostFlags = this.room.find(FIND_FLAGS, {
      filter: flag => flag.name.startsWith(OUTPOST_NAME_PREFIX)
    });

    // For each outpost flag found, check if we're tracking this outpost.
    // TODO: What happens if an outpost flag is removed?
    for (const flag of outpostFlags) {
      if (flag.name in this.outposts === false) {
        // Find all exits in the flag's quadrant of its room.
        const guardPositions = this.room.findWithinQuadrant(
          FIND_EXIT,
          flag.pos.quadrant()
        );

        // TODO: implement guarding specific targets indicated by some kind
        // of flag. e.g, look for objects in room with "guarded" flag.

        const perimeter = flag.pos.perimeter(OUTPOST_RANGE, guardPositions);

        // Save new outpost to memory and run-time list
        this.memory.outposts[flag.name] = Outpost.createMemory(
          flag,
          OUTPOST_RANGE,
          perimeter
        );
        this.outposts[flag.name] = Outpost.getInstance(
          this.memory.outposts[flag.name]
        );
      }
    }

    // Let each outpost do it's work
    for (const name in this.outposts) {
      this.outposts[name].run();
    }

    // Submit resource requests from outposts to resource manager
    const requestLists: ResourceRequestFromBucket[][] = [];
    for (const name in this.outposts) {
      const req = this.outposts[name].requestResources();
      requestLists.push(req);
    }
    const requests = requestLists.reduce((acc, val) => acc.concat(val), []);
    this.deliveryService.acceptResourceRequests(requests);

    // Draw outpost debug overlay for each outpost
    if (debug) {
      for (const name in this.outposts) {
        Outpost.drawOverlayFor(this.outposts[name]);
      }
    }
  }
}
