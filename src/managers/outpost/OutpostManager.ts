import { OUTPOST_NAME_PREFIX, OUTPOST_RANGE, debug } from "screeps.constants";
import DeliveryService from "services/DeliveryService";
import Outpost from "./Outpost";

export default class OutpostManager {
  public room: Room;
  public outposts: Record<string, Outpost> = {};
  private outpostMemory: Record<string, OutpostMemory>;
  private deliveryService: DeliveryService;

  public constructor(
    outpostMemory: Record<string, OutpostMemory>,
    room: Room,
    resourceService: DeliveryService
  ) {
    this.room = room;
    this.outpostMemory = outpostMemory;
    this.deliveryService = resourceService;

    for (const name in this.outpostMemory) {
      this.outposts[name] = Outpost.getInstance(outpostMemory[name]);
    }
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
        // Save new outpost to memory and run-time list
        const newOutpostMemory = Outpost.createMemory(flag, OUTPOST_RANGE);
        this.outpostMemory[flag.name] = newOutpostMemory;
        this.outposts[flag.name] = Outpost.getInstance(newOutpostMemory);
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
