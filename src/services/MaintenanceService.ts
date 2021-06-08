import BestParts from "utils/BestParts";
import Queue from "utils/Queue";
import { Identifiable } from "utils/typeGuards";
import { RoleMaintainer } from "roles";

interface RoomMaintenance {
  roomName: string;
  requestQueue: Queue<MaintenanceRequest>;
}

export default class MaintenanceService {
  private static instance: MaintenanceService;
  private rooms: Record<string, RoomMaintenance>;

  private get memory(): Record<string, MaintenanceServiceMemory> {
    return Memory.maintenance;
  }

  private set memory(mem: Record<string, MaintenanceServiceMemory>) {
    Memory.maintenance = mem;
  }

  private constructor() {
    this.rooms = {};

    // Add room maintenance info for any new rooms
    for (const roomName in Game.rooms) {
      if (roomName in this.memory === false)
        this.memory[roomName] = MaintenanceService.createMemory(roomName);
    }

    // Construct maintenance trackers for each room
    for (const roomName in this.memory) {
      const requestQueue = new Queue<MaintenanceRequest>(
        this.memory[roomName].requestQueue
      );

      this.rooms[roomName] = {
        roomName,
        requestQueue
      };
    }
  }

  public run(): void {
    // Run maintenance tasks for each room being tracked.
    for (const roomName in this.rooms) {
      const peeked = this.rooms[roomName].requestQueue.peek();

      // We peek at the first request so that we can work it without removing,
      // since there is no guarantee that it can be fulfilled this tick.
      if (peeked) {
        // TODO: handle other request types
        if (peeked.type === "personnel") {
          // See if we can accommodate the personnel request
          const availableSpawn = Game.rooms[roomName]
            .find(FIND_MY_SPAWNS)
            .find(s => !s.spawning);

          if (availableSpawn) {
            const parts = BestParts(RoleMaintainer, availableSpawn);
            if (!parts.length) continue;
            const name = `Maintainer${Game.time}`;
            const res = availableSpawn.spawnCreep(parts, name, {
              memory: {
                role: RoleMaintainer,
                ownerTag: peeked.ownerTag
              }
            });

            // If we were able to schedule a spawn, we subtract one from
            // the creep count for the request at which we peeked. If the
            // creep count is 0, the request has been fulfilled and we can
            // trash it.
            if (res === OK) {
              peeked.creepCount--;
              if (peeked.creepCount <= 0) {
                this.rooms[roomName].requestQueue.dequeue();
              }
            }
          }
        }
      }
    }

    // Save maintenance memory
    this.save();
  }

  private save(): void {
    // Save arrays for each room's request queue
    for (const room in this.rooms) {
      this.memory[room].requestQueue = this.rooms[room].requestQueue.queue;
    }
  }

  private static createMemory(roomName: string): MaintenanceServiceMemory {
    return {
      roomName,
      requestQueue: []
    };
  }

  public static getInstance(): MaintenanceService {
    if (!MaintenanceService.instance) {
      MaintenanceService.instance = new MaintenanceService();
    }
    return MaintenanceService.instance;
  }

  public submitPersonnelRequest<T extends Identifiable>(
    roomName: string,
    ownerTag: Id<T>,
    creepCount = 1
  ): OK {
    if (roomName in Game.rooms === false) {
      const msg = `${roomName} not found.`;
      // return new MaintenanceError(InvalidRoomError, msg);
      return OK;
    }

    if (roomName in this.rooms === false) {
      const msg = `Room ${roomName} is not being tracked by the maintenance service.`;
      // return new MaintenanceError(MaintenanceNotTrackedError, msg);
      return OK;
    }

    if (!Game.getObjectById(ownerTag)) {
      const msg = `Object with id ${ownerTag} not found.`;
      // return new MaintenanceError(InvalidOwnerError, msg);
      return OK;
    }

    // Don't submit if we already have a personnel request from this owner
    const match = this.rooms[roomName].requestQueue.queue.find(req => {
      return req.type === "personnel" && req.ownerTag === (ownerTag as string);
    });
    if (match) {
      const msg = `Owner ${ownerTag} already has a personnel request.`;
      // return new MaintenanceError(RequestAlreadySubmittedError, msg);
      return OK;
    }

    // If we have a good room, owner, and request, queue the request.
    const maintenanaceReq: MaintenanceRequest = {
      roomName,
      type: "personnel",
      ownerTag,
      creepCount
    };

    this.rooms[roomName].requestQueue.enqueue(maintenanaceReq);
    return OK;
  }
}
