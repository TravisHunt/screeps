// #region imports
import BestParts from "utils/BestParts";
import Queue from "utils/Queue";
import IRunnable from "interfaces/IRunnable";
import { Identifiable } from "utils/typeGuards";
import { RoleMaintainer } from "roles";
import {
  InvalidOwnerError,
  InvalidRoomError,
  MaintenanceNotTrackedError,
  MaintenanceOk,
  MaintenanceRequest,
  MaintenanceServiceMemory,
  MaintenanceStatus,
  RequestAlreadySubmittedError,
  RoomMaintenance
} from "./maintenance.types";
// #endregion imports

/**
 * MaintenanceService operates above the room level. This service uses the
 * singleton pattern so that a single instance can be imported by any room
 * service. For each visible room, this service processes requests for
 * maintainer creeps.
 */
export default class MaintenanceService implements IRunnable {
  /**
   * Singleton MaintenanceService instance.
   */
  private static instance: MaintenanceService;

  /**
   * Maintenance memory grouped by room name.
   */
  private rooms: Record<string, RoomMaintenance>;

  /**
   * Memory.maintenance getter
   */
  private get memory(): Record<string, MaintenanceServiceMemory> {
    return Memory.maintenance;
  }

  /**
   * Memory.maintenance setter
   */
  private set memory(mem: Record<string, MaintenanceServiceMemory>) {
    Memory.maintenance = mem;
  }

  /**
   * MaintenanceService operates above the room level. This service uses the
   * singleton pattern so that a single instance can be imported by any room
   * service. For each visible room, this service processes requests for
   * maintainer creeps.
   */
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

  /**
   * Runs per-tick MaintenanceService tasks for each room.
   * 1) Peeks at first request in queue.
   * 2) Attempts to fill personnel request by spawning a maintainer.
   * 3) TODO: handle service requests.
   */
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

  /**
   * Saves maintenance memory for each visible room.
   */
  private save(): void {
    // Save arrays for each room's request queue
    for (const room in this.rooms) {
      this.memory[room].requestQueue = this.rooms[room].requestQueue.queue;
    }
  }

  /**
   * Creates a memory object for the given room.
   * @param roomName - Room name
   * @returns Maintenance memory object for room
   */
  private static createMemory(roomName: string): MaintenanceServiceMemory {
    return {
      roomName,
      requestQueue: []
    };
  }

  /**
   * Retrieves the MaintenanceService singleton.
   * @returns Singleton instance
   */
  public static getInstance(): MaintenanceService {
    if (!MaintenanceService.instance) {
      MaintenanceService.instance = new MaintenanceService();
    }
    return MaintenanceService.instance;
  }

  /**
   * Queues a valid maintenance request to be processed when the MaintenanceService
   * perform's it's per-tick process.
   * @param roomName - Name of room
   * @param ownerTag - Id of object making request
   * @param creepCount - Optional number of creep requested. Default to 1.
   * @returns Status of request
   */
  public submitPersonnelRequest<T extends Identifiable>(
    roomName: string,
    ownerTag: Id<T>,
    creepCount = 1
  ): MaintenanceStatus {
    // Is this room visible?
    if (roomName in Game.rooms === false) {
      const message = `${roomName} not found.`;
      return { code: InvalidRoomError, message };
    }

    // Do we have a maintenance memory object for this room?
    if (roomName in this.rooms === false) {
      const message = `Room ${roomName} is not being tracked by the maintenance service.`;
      return { code: MaintenanceNotTrackedError, message };
    }

    // Is this a valid game object id? It's possible that a structure was
    // destroyed or the owner died.
    if (!Game.getObjectById(ownerTag)) {
      const message = `Object with id ${ownerTag} not found.`;
      return { code: InvalidOwnerError, message };
    }

    // Don't submit if we already have a personnel request from this owner
    const match = this.rooms[roomName].requestQueue.queue.find(req => {
      return req.type === "personnel" && req.ownerTag === (ownerTag as string);
    });
    if (match) {
      const message = `Owner ${ownerTag} already has a personnel request.`;
      return { code: RequestAlreadySubmittedError, message };
    }

    // If we have a good room, owner, and request, queue the request.
    const maintenanaceReq: MaintenanceRequest = {
      roomName,
      type: "personnel",
      ownerTag,
      creepCount
    };

    this.rooms[roomName].requestQueue.enqueue(maintenanaceReq);
    return {
      code: MaintenanceOk,
      message: `Maintenance request queued: ${JSON.stringify(maintenanaceReq)}`
    };
  }
}
