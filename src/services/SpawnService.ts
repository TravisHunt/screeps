import { Dictionary } from "lodash";
import Spawn from "wrappers/Spawn";

/**
 * Service for managing access to spawns and various spawn processes. This is
 * used to locate available spawns, manage renewal access, etc.
 */
export default class SpawnService implements IRunnable {
  private static instance: SpawnService;
  private spawns: Dictionary<Spawn> = {};
  private renewalWaitingLookup: Record<string, string> = {};

  private get spawnLedger(): SpawnLedger {
    return Memory.spawns;
  }

  private set spawnLedger(ledger: SpawnLedger) {
    Memory.spawns = ledger;
  }

  private constructor() {
    if (!this.spawnLedger) this.spawnLedger = {};
  }

  /**
   * Refresh spawn and renewal lookup data on game ticks.
   */
  private refresh(): void {
    // Check for destroyed spawns
    for (const name in this.spawnLedger) {
      // Spawn must have been destroyed. Delete.
      if (name in Game.spawns === false) {
        delete this.spawnLedger[name];
      }
    }
    // Check for new spawns
    for (const name in Game.spawns) {
      if (name in this.spawnLedger === false) {
        this.spawnLedger[name] = Spawn.createMemory(Game.spawns[name]);
      }
    }
    // Reset spawn ledger and flat waiting list.
    this.spawns = {};
    this.renewalWaitingLookup = {};
    for (const spawnName in this.spawnLedger) {
      this.spawns[spawnName] = new Spawn(Game.spawns[spawnName]);
      // Update our flat list of creep names waiting for renewal.
      for (const creep of this.spawns[spawnName].renewalQueue.queue) {
        this.renewalWaitingLookup[creep.name] = spawnName;
      }
    }
  }

  /**
   * Gets the SpawnService singleton. Refresh to rebuild lookup data with
   * current game data.
   * @param refresh - Should the singleton refresh its lookup data.
   * @returns SpawnService singleton
   */
  public static getInstance(refresh = false): SpawnService {
    if (!SpawnService.instance) {
      SpawnService.instance = new SpawnService();
    }
    if (refresh) {
      SpawnService.instance.refresh();
    }
    return SpawnService.instance;
  }

  /**
   * Run per-tick SpawnService processes.
   */
  public run(): void {
    // Clean all Spawn instances
    for (const name in this.spawns) {
      this.spawns[name].dispose();
    }
  }

  /**
   * True if SpawnService is tracking a spawn with this name.
   * @param spawnName - Spawn name string
   * @returns True if SpawnService knows this spawn name.
   */
  public validSpawnName(spawnName: string): boolean {
    return spawnName in this.spawns;
  }

  /**
   * Checks if the given Creep is first in line for renewal at its
   * renewalTarget.
   * @param creep - Creep requesting renewal
   * @returns True if Creep is first in line at its renewalTarget.
   */
  public frontOfLine(creep: Creep): boolean {
    if (creep.name in this.renewalWaitingLookup === false) return false;
    const spawnName = this.renewalWaitingLookup[creep.name];
    if (spawnName in this.spawns === false) return false;
    const spawn = this.spawns[spawnName];
    const head = spawn.renewalQueue.peek();
    return !!head && head.name === creep.name;
  }

  /**
   * Checks if the given Creep is in a renewal queue.
   * @param creep - Creep requesting renewal
   * @returns True if Creep is in waiting list, otherwise False.
   */
  public waitingForRenewal(creep: Creep): boolean {
    return creep.name in this.renewalWaitingLookup;
  }

  /**
   * Adds the Creep to the closest available spawn's renewal queue.
   * @param creep - Creep requesting renewal
   * @returns The Creep's position in the renewal queue
   */
  public queueForRenewal(creep: Creep): number {
    // Do nothing if creep is already waiting.
    if (this.waitingForRenewal(creep)) {
      const spawnName = this.renewalWaitingLookup[creep.name];
      const spawn = this.spawns[spawnName];
      return spawn.renewalQueue.position(creep);
    }

    // Find closest spawn
    const closest = this.closestSpawnTo(creep.pos);
    // TODO: Should probably return status code
    if (!closest) return -1;

    // Add creep to spawn's renewal queue and flat waiting list.
    // Set creep's renewal target.
    const positionInLine = closest.addToRenewalQueue(creep);
    this.renewalWaitingLookup[creep.name] = closest.name;

    return positionInLine;
  }

  /**
   * Check if the creep is able to renew at its renewal target. True if the
   * given creep is first in line in the renewal target's renewal queue.
   * Renewal specs found here https://docs.screeps.com/api/#StructureSpawn.renewCreep
   * @param creep - Creep requesting renewal
   */
  public canRenew(creep: Creep): boolean {
    if (creep.body.find(bp => bp.type === CLAIM)) return false;
    if (!this.frontOfLine(creep)) return false;

    const spawnName = this.renewalWaitingLookup[creep.name];
    const spawn = this.spawns[spawnName];
    const head = spawn.renewalQueue.peek();

    const retVal =
      !spawn.spawning &&
      spawn.store[RESOURCE_ENERGY] > creep.renewalCost() &&
      !!head &&
      head.name === creep.name;

    return retVal;
  }

  /**
   * Get the Spawn instance assigned to the given Creep for renewal.
   * @param creep - Creep requesting renewal
   * @returns Spawn instances
   */
  public getSpawnForRenewal(creep: Creep): Spawn {
    const spawnName = this.renewalWaitingLookup[creep.name];
    return this.spawns[spawnName];
  }

  /**
   * Returns the closest Spawn to pos within the same room.
   * @param pos - Room position
   * @returns The closest Spawn to pos within the same room
   */
  public closestSpawnTo(pos: RoomPosition): Spawn | undefined {
    // For the time being, we limit by room. Eventually we'll be able to
    // match to spawns in different rooms if they're the closest.
    const sameRoom = _.filter(this.spawns, function (spawn) {
      return spawn.room.name === pos.roomName;
    });
    // Sort by distance from position to spawn in ascending order.
    const sortedByDistance = _.sortBy(sameRoom, [
      function (spawn: Spawn) {
        return pos.distanceTo(spawn.pos);
      }
    ]);
    // Closest spawn by distance is first in sorted list or undefined.
    return _.head(sortedByDistance);
  }

  /**
   * Call this when the Creep is done renewing. You can tell that a creep is
   * done renewing when spawn.renewCreep returns ERR_FULL.
   * @param creep - Creep that finished renewing
   */
  public renewalComplete(creep: Creep): void {
    if (!this.waitingForRenewal(creep)) return;
    const spawn = this.getSpawnForRenewal(creep);

    // A creep calling this method should be at the front of the spawn's
    // renewalQueue. Dequeue the creep and delete the creep's entry from
    // the waiting list.
    if (this.frontOfLine(creep)) {
      spawn.renewalQueue.dequeue();
    } else {
      // If this creep is not at the head of this head of this queue, the creep
      // is either confused or it some how was renewed elsewhere. Either way,
      // splice it out of the queue.
      spawn.renewalQueue.remove(creep);
    }

    // Remove creep from waiting list
    delete this.renewalWaitingLookup[creep.name];
  }
}
