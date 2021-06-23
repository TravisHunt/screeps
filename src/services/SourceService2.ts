import SourceWrapper from "wrappers/SourceWrapper";
import MaintenanceService from "./MaintenanceService";
import SpawnService from "./SpawnService";
import StorageService from "./StorageService";
import { RoleMaintainer } from "roles";
import { debug, RENEW_THRESHOLD } from "screeps.constants";
import {
  HARVEST_POS,
  HARVEST_POS_OCCUPIED,
  PATH_COLOR,
  PATH_COLOR_HARVEST,
  PATH_COLOR_REPAIR
} from "palette";

/**
 * Singleton service that manages access to source locations in owned rooms.
 * Primarily used by harvesters, this can be used to claim locks on harvest
 * positions to avoid creep collisions.
 */
export default class SourceService2 implements IRunnable {
  private static instance: SourceService2;
  private lookup: ISourceServiceLookup = {};
  private maintenanceService: MaintenanceService;
  private spawnService: SpawnService;
  private storageService: StorageService;
  // TODO: implement queue for harvest position lock

  private get memory(): SourceServiceLookupMemory {
    return Memory.sourceService;
  }

  private set memory(mem: SourceServiceLookupMemory) {
    Memory.sourceService = mem;
  }

  private constructor() {
    if (!this.memory) this.memory = {};
    this.maintenanceService = MaintenanceService.getInstance();
    this.spawnService = SpawnService.getInstance();
    this.storageService = StorageService.getInstance();
  }

  /**
   * Gets service singleton instance. Refresh game data at top of game tick.
   * @param refresh - Should the service refresh its game data
   * @returns SourceService singleton
   */
  public static getInstance(refresh = false): SourceService2 {
    if (!SourceService2.instance) {
      SourceService2.instance = new SourceService2();
    }
    if (refresh) {
      SourceService2.instance.refresh();
    }
    return SourceService2.instance;
  }

  /**
   * Generates empty lookup object for a specific room.
   */
  public static createRoomMemory(roomName: string): SourceServiceRoomMemory {
    return { roomName, sources: {}, maintainers: [] };
  }

  /**
   * Runs the main SourceService process. This manages queues, saves to memory,
   * draws overlays, etc.
   */
  public run(): void {
    // Make sure we have maintainers to maintain harvest positions.
    _.each(this.lookup, room => {
      // TODO: remove need for ownerTag
      const owner = _.map(room.sources, src => src.source)[0];

      // TODO: allow for multiple maintainers
      if (room.maintainers.length < 1) {
        this.maintenanceService.submitPersonnelRequest(room.roomName, owner.id);
      }

      // Scan for spawning maintainers
      const spawns = Game.rooms[room.roomName].find(FIND_MY_SPAWNS);
      for (const s of spawns) {
        if (!s.spawning) continue;
        const spawning = Game.creeps[s.spawning.name];
        if (spawning.memory.ownerTag && spawning.memory.ownerTag === owner.id) {
          room.maintainers.push(spawning);
        }
      }

      this.runMaintainers(room);
    });

    // Save run-time changes to memory. This should be the last step.
    this.save();

    // Highlight occupiable resource positions while in debug mode
    if (debug) {
      _.each(this.lookup, room => {
        const visual = new RoomVisual(room.roomName);
        _.each(room.sources, src => {
          for (const hp of src.harvestPositions) {
            const color = hp.locked ? HARVEST_POS_OCCUPIED : HARVEST_POS;
            visual.circle(hp.x, hp.y, { fill: color, radius: 0.5 });
          }
        });
      });
    }
  }

  /**
   * Returns all links in the given room that are being tracked by the source
   * service.
   * @param room - Room for this search
   * @returns All links in this room captured by the source service.
   */
  public links(room: Room): StructureLink[] {
    if (room.name in this.lookup === false) return [];
    const lookup = this.lookup[room.name];
    const links = _.filter(lookup.sources, s => !!s.link).map(
      s => s.link as StructureLink
    );
    return links;
  }

  /**
   * Attempts to find the best link managed by this service. Links are sorted
   * by energy on hand.
   * @param room - Link in this Room
   * @param ready - True if link must not be cooling down. True by default.
   * @param full - True if link must be full. False by default.
   * @returns Best link if one can be found.
   */
  public link(
    room: Room,
    ready = true,
    full = false
  ): StructureLink | undefined {
    if (room.name in this.lookup === false) return;
    const lookup = this.lookup[room.name];
    const links = _.filter(lookup.sources, s => {
      if (!s.link) return false;

      let valid = true;
      if (ready) valid = valid && s.link.ready();
      if (full) valid = valid && s.link.full();

      return valid;
    })
      .map(s => s.link as StructureLink)
      .sort((a, b) => a.usedCapacity() - b.usedCapacity())
      .reverse();

    return links.length > 0 ? links[0] : undefined;
  }

  /**
   * Gets the total number of harvest positions within the given room.
   * @param roomName - Room name to search in.
   * @returns Number of harvest positions.
   */
  public totalHarvestPositionCountIn(roomName: string): number {
    if (roomName in this.lookup === false) return -1;
    const lookup = this.lookup[roomName];
    const total = _.reduce(
      lookup.sources,
      (count, src) => count + src.harvestPositions.length,
      0
    );

    return total;
  }

  /**
   * Get build requests from sources. In certain scenarios, sources may discover
   * adjacent positions that could be utilized if a road was built.
   * @param roomName - Name of operating room.
   * @returns Builds requested by all sources.
   */
  public requestedBuildsIn(roomName: string): BuildRequest[] {
    if (roomName in this.lookup === false) return [];
    const lookup = this.lookup[roomName];
    const requests: BuildRequest[] = [];

    // Gather any harvest positions that have yet to be built. Sort by harvest
    // position count so the source with the least amount of positions is
    // queued first.
    const sortedByHarvestPosCount = _.map(lookup.sources, src => src).sort(
      (a, b) => a.harvestPositions.length - b.harvestPositions.length
    );

    // For each source, see if it has positions that could be tracked as a
    // harvest position, but currently are not.
    for (const src of sortedByHarvestPosCount) {
      const positions = src.findUnusedHarvestPositions() as RoomPosition[];
      if (positions.length) {
        requests.push({ type: STRUCTURE_ROAD, positions });
      }
    }

    return requests;
  }

  public requestedRoadRepairsIn(roomName: string): StructureRoad[] {
    if (roomName in this.lookup === false) return [];
    const lookup = this.lookup[roomName];
    const roadsToRepair: StructureRoad[] = [];

    _.each(lookup.sources, src =>
      roadsToRepair.concat(src.harvestPositionRepairs())
    );

    return roadsToRepair;
  }

  /**
   * Locks and returns a harvest position for a source within the Creep's room.
   * Be sure to unlock the position when the Creep is done using it, by calling
   * SourceService.unlockHarvestPosition
   * @param creep - Creep request lock on harvest position
   * @returns Best available harvest position, if available.
   */
  public lockHarvestPosition(creep: Creep): IHarvestLock | undefined {
    const roomLookup = this.lookup[creep.room.name];
    if (!roomLookup) return;

    const bestSrc = SourceService2.bestHarvestSource(roomLookup);
    if (!bestSrc) return;

    const pos = bestSrc.availableHarvestPositions.find(p => !p.locked);
    if (pos) {
      pos.locked = true;
      console.log(`${creep.name} locked position ${pos.toString()}`);
    }

    return pos;
  }

  /**
   * Unlocks the given harvest position so that it may be given to another
   * harvester.
   * @param pos - Position to be unlocked
   */
  public unlockHarvestPosition(pos: IHarvestLock): void {
    const roomLookup = this.lookup[pos.roomName];
    if (!roomLookup) return;

    // Make sure this position belongs to a source. If it does, unlock.
    _.each(roomLookup.sources, src => {
      for (const hp of src.harvestPositions) {
        if (hp.isEqualTo(pos.x, pos.y)) {
          hp.locked = false;
          break;
        }
      }
    });
  }

  /**
   * Finds the best source for harvesting within the given room. A source is
   * rated on energy and harvest positions available.
   * @param roomLookup - Lookup object for a specific room
   * @returns Source wrapper for a source in this room
   */
  private static bestHarvestSource(
    roomLookup: ISourceServiceRoom
  ): SourceWrapper | null {
    const hasAvailable = _.filter(
      roomLookup.sources,
      src => src.energy > 0 && src.availableHarvestPositions.length > 0
    )
      .sort(
        (a, b) =>
          a.availableHarvestPositions.length -
          b.availableHarvestPositions.length
      )
      .reverse();

    if (hasAvailable.length) {
      return hasAvailable[0] as SourceWrapper;
    }

    return hasAvailable.length > 0 ? (hasAvailable[0] as SourceWrapper) : null;
  }

  /**
   * Refreshes memory and builds look up object on new tick.
   */
  private refresh(): void {
    // If I've lost control of a room.
    for (const roomName in this.memory) {
      if (roomName in Game.rooms === false) {
        delete this.memory[roomName];
      }
    }

    // Make sure we're collecting sources from all of my rooms.
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (!room.my()) continue;

      // If this is a newly acquired room, generate memory objects for the sources.
      if (!this.memory[roomName]) {
        const sources = room.find(FIND_SOURCES);
        if (!sources.length) continue;
        this.memory[roomName] = SourceService2.createRoomMemory(roomName);
        for (const s of sources) {
          this.memory[roomName].sources[s.id] = SourceWrapper.createMemory(s);
        }
      }
    }

    // Build run-time source accessor
    this.lookup = {};
    for (const roomName in this.memory) {
      const room = this.memory[roomName];
      const maintainers = Game.rooms[roomName].creepsWithRole(RoleMaintainer);
      room.maintainers = maintainers.map(m => m.name);

      // TODO: I should find a better way to do this, because it's ugly.
      const sources = _.map(room.sources, (mem, id) => {
        if (!id) return null;
        const src = Game.getObjectById(id as Id<Source>);
        if (!src) return null;
        return new SourceWrapper(src, mem);
      })
        .filter(sw => sw !== null)
        .map(sw => sw as SourceWrapper);

      const sourceLookup: ISourceLookup = {};
      sources.forEach(s => (sourceLookup[s.id] = s));

      this.lookup[roomName] = {
        roomName,
        maintainers,
        sources: sourceLookup
      };
    }
  }

  /**
   * Saves run-time changes to the look up structure to memory.
   */
  private save(): void {
    for (const roomName in this.lookup) {
      const roomLookup = this.lookup[roomName];
      const memory = this.memory[roomName];

      memory.maintainers = roomLookup.maintainers.map(m => m.name);
      _.each(roomLookup.sources, (src, id) => {
        if (src && id) {
          memory.sources[id].linkId = src.linkId;
          memory.sources[id].harvestPositions = src.harvestPositions;
        }
      });
    }
  }

  /**
   * Drives maintainers in the given room.
   * @param lookup - Room data lookup
   */
  private runMaintainers(lookup: ISourceServiceRoom): void {
    const available = lookup.maintainers.filter(c => !c.spawning);
    if (!available.length) return;

    const roads = _.reduce(
      lookup.sources,
      (structs, src) => {
        return structs.concat(src.harvestPositionRepairs());
      },
      [] as StructureRoad[]
    );

    if (!roads.length) return;

    for (const creep of available) {
      // If below the ticks to live threshold, we want to renew until full.
      if (creep.ticksToLive && creep.ticksToLive < RENEW_THRESHOLD) {
        creep.memory.renewing = true;
      }

      // Ask spawn service if it's my turn to renew
      if (this.spawnService.canRenew(creep)) {
        // Get spawn from spawn ledger
        const spawn = this.spawnService.getSpawnForRenewal(creep);

        // Attempt to renew
        const code = spawn.renewCreep(creep);
        switch (code) {
          case ERR_NOT_IN_RANGE:
            creep.moveTo(spawn, { visualizePathStyle: { stroke: PATH_COLOR } });
            continue;
          case ERR_FULL:
            // Tell spawn service that I'm done renewing
            this.spawnService.renewalComplete(creep);
            creep.memory.renewing = false;
            break;
          default:
            continue;
        }
      } else if (creep.memory.renewing) {
        const position = this.spawnService.queueForRenewal(creep);
        if (position === -1)
          console.log(`Failed to queue ${creep.name} for renewal!`);
      }

      // Renewal skipped or finished. Continue regular work.
      if (creep.memory.harvesting && !creep.freeCapacity(RESOURCE_ENERGY)) {
        creep.memory.harvesting = false;
      }
      if (!creep.memory.harvesting && !creep.usedCapacity(RESOURCE_ENERGY)) {
        creep.memory.harvesting = true;
      }

      // Get storage from storage service
      if (creep.memory.harvesting) {
        const storage = this.storageService.getNearestStorage(creep.pos);
        if (storage) {
          const res = creep.withdraw(storage.target, RESOURCE_ENERGY);
          if (res === ERR_NOT_IN_RANGE) {
            creep.moveTo(storage, {
              visualizePathStyle: { stroke: PATH_COLOR_HARVEST }
            });
          }
        }
      } else {
        if (creep.repair(roads[0]) === ERR_NOT_IN_RANGE) {
          creep.moveTo(roads[0], {
            visualizePathStyle: { stroke: PATH_COLOR_REPAIR }
          });
        }
      }
    }
  }
}
