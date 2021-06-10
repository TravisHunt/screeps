import { OUTPOST_NAME_PREFIX, OUTPOST_RANGE, debug } from "screeps.constants";
import DeliveryService from "services/DeliveryService";
import Outpost from "./Outpost";
import { QUADRANTS } from "utils/enums";

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
        // Find quadrant to search for exits or guard targets
        const quadrant = flag.pos.quadrant();

        // TODO: implement guarding specific targets indicated by some kind
        // of flag. e.g, look for objects in room with "guarded" flag.
        const axis = 25;
        const allExits = this.room.find(FIND_EXIT);
        let guardPositions: RoomPosition[] = [];

        if (quadrant === QUADRANTS.I) {
          guardPositions = allExits.filter(p => p.x >= axis && p.y >= axis);
        } else if (quadrant === QUADRANTS.II) {
          guardPositions = allExits.filter(p => p.x < axis && p.y >= axis);
        } else if (quadrant === QUADRANTS.III) {
          guardPositions = allExits.filter(p => p.x < axis && p.y < axis);
        } else if (quadrant === QUADRANTS.IV) {
          guardPositions = allExits.filter(p => p.x >= axis && p.y < axis);
        }

        let perimeter: Perimeter | undefined;

        // Construct a perimeter containing the guard positions
        if (guardPositions.length) {
          // Find min and max axis values using guard positions and outpost
          // range constant.
          const minX = Math.min(
            flag.pos.x - OUTPOST_RANGE,
            guardPositions.sort((p1, p2) => p1.x - p2.x)[0].x
          );
          const maxX = Math.max(
            flag.pos.x + OUTPOST_RANGE,
            guardPositions.sort((p1, p2) => p1.x - p2.x).reverse()[0].x
          );
          const minY = Math.min(
            flag.pos.y - OUTPOST_RANGE,
            guardPositions.sort((p1, p2) => p1.y - p2.y)[0].y
          );
          const maxY = Math.max(
            flag.pos.y + OUTPOST_RANGE,
            guardPositions.sort((p1, p2) => p1.y - p2.y).reverse()[0].y
          );

          // Construct outpost perimeter that includes guard positions
          perimeter = {
            x: { min: minX, max: maxX },
            y: { min: minY, max: maxY }
          };
        }

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
