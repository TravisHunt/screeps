import BuildManager from "managers/build/build.manager";
import HarvestManager from "managers/harvest.manager";
import Outpost from "managers/outpost/Outpost";
import OutpostManager from "managers/outpost/OutpostManager";
import HarvestQueue from "managers/resource/HarvestQueue";
import UpgradeManager from "managers/upgrade.manager";
import OneWayLink from "OneWayLink";
import {
  BUILDER_MAX,
  COURIER_MAX,
  HARVESTER_MAX,
  OUTPOST_RANGE,
  REPAIRMAN_MAX,
  UPGRADER_MAX
} from "screeps.constants";
import DeliveryService from "services/DeliveryService";
import ResourceService from "services/ResourceService";
import Queue from "utils/Queue";

export default class RoomManager {
  public room: Room;
  private sources: Source[] = [];
  private spawns: StructureSpawn[] = [];
  private extensions: StructureExtension[] = [];
  private containers: StructureContainer[] = [];
  private storages: StructureStorage[] = [];
  private terminals: StructureTerminal[] = [];
  private couriers: Creep[] = [];
  private outposts: Record<string, Outpost> = {};
  private harvestQueue: HarvestQueue;
  private deliveryQueue: Queue<ResourceRequestFromBucket>;
  private controllerLink?: OneWayLink;
  private resourceService: ResourceService;
  private outpostService: OutpostManager;
  private deliveryService: DeliveryService;
  private harvestManager: HarvestManager;
  private buildManager: BuildManager;
  private upgradeManager: UpgradeManager;

  private get memory(): RoomMemory {
    return Memory.rooms[this.room.name];
  }
  private set memory(mem: RoomMemory) {
    Memory.rooms[this.room.name] = mem;
  }

  private static idsToObjects<T extends RoomObject>(ids: Id<T>[]) {
    const objs = ids
      .map(id => Game.getObjectById(id) as T)
      .filter(obj => obj !== null);

    return objs;
  }

  public constructor(roomName: string, config?: RoomConfig) {
    if (roomName in Game.rooms === false) {
      throw new RoomNotFoundError(`${roomName} not found in Game.rooms`);
    }

    this.room = Game.rooms[roomName];

    // Construct a new memory object if this is the first time we're tracking
    // this room.
    if (!this.memory) {
      this.memory = RoomManager.createRoomMemoryObj();
    }

    // Migrate from old Memory structure if specified
    if (config && config.migrate) {
      RoomManager.migrateMemory(this.memory, this.room);
    }

    // Rescan for sources and store structures
    this.refreshIdCollections();

    // Check for energy link from source to controller
    this.refreshSourceToCtrlLink();

    // Build from stored ids
    this.sources = RoomManager.idsToObjects(this.memory.sourceIds);
    this.spawns = RoomManager.idsToObjects(this.memory.spawnIds);
    this.extensions = RoomManager.idsToObjects(this.memory.extensionIds);
    this.containers = RoomManager.idsToObjects(this.memory.containerIds);
    this.storages = RoomManager.idsToObjects(this.memory.storageIds);
    this.terminals = RoomManager.idsToObjects(this.memory.terminalIds);

    this.couriers = this.memory.courierNames
      .map(name => Game.creeps[name])
      .filter(c => c !== null);
    this.memory.courierNames = this.couriers.map(c => c.name);

    this.harvestQueue = new HarvestQueue(this.memory.harvestQueue);
    this.deliveryQueue = new Queue<ResourceRequestFromBucket>(
      this.memory.deliveryQueue
    );

    // gather links
    if (this.memory.controllerLink) {
      const srcLink = this.memory.controllerLink.a
        ? Game.getObjectById(this.memory.controllerLink.a)
        : null;
      const controllerLink = this.memory.controllerLink.b
        ? Game.getObjectById(this.memory.controllerLink.b)
        : null;

      if (srcLink && controllerLink)
        this.controllerLink = new OneWayLink(srcLink, controllerLink);
    }

    // Build outpost instances
    for (const name in this.memory.outposts) {
      this.outposts[name] = Outpost.getInstance(this.memory.outposts[name]);
    }

    // Init service for managing access to source harvesting
    this.resourceService = new ResourceService(
      this.room,
      this.sources,
      this.spawns,
      this.extensions,
      this.containers,
      this.storages,
      this.terminals,
      this.couriers,
      this.harvestQueue,
      this.memory,
      this.controllerLink
    );

    // Init service for managing resource deliveries
    this.deliveryService = new DeliveryService(
      this.room,
      this.memory,
      this.couriers,
      (config && config.courierMax) || COURIER_MAX,
      this.deliveryQueue,
      this.resourceService
    );

    // Init service for managing outposts
    this.outpostService = new OutpostManager(
      this.room,
      this.memory,
      this.outposts,
      this.deliveryService
    );

    // Init manager for harvester creeps
    const harvesterMax =
      (config && config.harvesterMax) ||
      this.resourceService.harvestPositionCount ||
      HARVESTER_MAX;

    this.harvestManager = new HarvestManager(
      this.room,
      this.memory,
      harvesterMax,
      this.resourceService
    );

    // Init manager for builder creeps
    this.buildManager = new BuildManager(
      this.room,
      this.memory,
      (config && config.builderMax) || BUILDER_MAX,
      (config && config.repairmanMax) || REPAIRMAN_MAX,
      this.resourceService
    );

    // Init manager for upgrader creeps
    this.upgradeManager = new UpgradeManager(
      this.room,
      this.memory,
      (config && config.upgraderMax) || UPGRADER_MAX,
      this.resourceService
    );
  }

  public run(): void {
    this.harvestManager.run();
    this.buildManager.run();
    this.upgradeManager.run();

    // Run outposts
    this.outpostService.run();

    // Run jobs for managed resources
    this.resourceService.run();

    // Run delivery jobs
    this.deliveryService.run();

    for (const spawn of this.spawns) {
      // Visualize spawning
      if (spawn.spawning) {
        const spawningCreep = Game.creeps[spawn.spawning.name];
        spawn.room.visual.text(
          "🛠️" + spawningCreep.memory.role,
          spawn.pos.x + 1,
          spawn.pos.y,
          {
            align: "left",
            opacity: 0.8
          }
        );
      }
    }
  }

  private static createRoomMemoryObj(): RoomMemory {
    return {
      state: {
        spawnAdjacentWalkways: { inprogress: false, complete: false },
        roadFromSpawnToCtrl: { inprogress: false, complete: false },
        roadFromSpawnToEnergySources: { inprogress: false, complete: false },
        sourceQueueRoad: { inprogress: false, complete: false },
        outpostRoads: {}
      },

      buildQueue: [],

      harvestQueue: [],
      deliveryQueue: [],
      courierNames: [],

      managedSources: [],

      spawnIds: [],
      extensionIds: [],
      sourceIds: [],
      containerIds: [],
      storageIds: [],
      terminalIds: [],
      rampartIds: [],
      towerIds: [],
      wallIds: [],

      outposts: {}
    };
  }

  private static migrateMemory(memory: RoomMemory, room: Room): void {
    console.log("Memory migration not implemented!");
  }

  private refreshIdCollections(): void {
    this.memory.sourceIds = this.room.find(FIND_SOURCES).map(s => s.id);

    const structures = this.room.find(FIND_STRUCTURES);

    this.memory.spawnIds = structures
      .filter(s => s.structureType === STRUCTURE_SPAWN)
      .map(s => s.id as Id<StructureSpawn>);

    this.memory.extensionIds = structures
      .filter(s => s.structureType === STRUCTURE_EXTENSION)
      .map(s => s.id as Id<StructureExtension>);

    this.memory.containerIds = structures
      .filter(s => s.structureType === STRUCTURE_CONTAINER)
      .map(s => s.id as Id<StructureContainer>);

    this.memory.storageIds = structures
      .filter(s => s.structureType === STRUCTURE_STORAGE)
      .map(s => s.id as Id<StructureStorage>);

    this.memory.terminalIds = structures
      .filter(s => s.structureType === STRUCTURE_TERMINAL)
      .map(s => s.id as Id<StructureTerminal>);

    this.memory.rampartIds = structures
      .filter(s => s.structureType === STRUCTURE_RAMPART)
      .map(s => s.id as Id<StructureRampart>);

    this.memory.towerIds = structures
      .filter(s => s.structureType === STRUCTURE_TOWER)
      .map(s => s.id as Id<StructureTower>);

    this.memory.wallIds = structures
      .filter(s => s.structureType === STRUCTURE_WALL)
      .map(s => s.id as Id<StructureWall>);
  }

  private refreshSourceToCtrlLink() {
    // Controller must be >= level 5 to consider links.
    if (!this.room.controller || this.room.controller.level < 5) return;

    let sourceLink: StructureLink | null = null;
    let controllerLink: StructureLink | null = null;

    // Be sure to remove a link id if it was destroyed.
    if (this.memory.controllerLink) {
      if (this.memory.controllerLink.a) {
        sourceLink = Game.getObjectById(this.memory.controllerLink.a);
      }
      if (this.memory.controllerLink.b) {
        controllerLink = Game.getObjectById(this.memory.controllerLink.b);
      }
    }

    // We don't have a source link. Scan for one.
    if (!sourceLink) {
      for (const src of this.sources) {
        const found = src.pos.findInRange(FIND_MY_STRUCTURES, OUTPOST_RANGE, {
          filter: { structureType: STRUCTURE_LINK }
        });
        console.log(JSON.stringify(found));
        if (found.length) {
          sourceLink = found[0] as StructureLink;
          break;
        }
      }
    }

    // We don't have a controller link. Scan for one.
    if (!controllerLink) {
      const found = this.room.controller.pos.findInRange(
        FIND_MY_STRUCTURES,
        OUTPOST_RANGE,
        { filter: { structureType: STRUCTURE_LINK } }
      );

      if (found.length) controllerLink = found[0] as StructureLink;
    }

    // If we have at least half the link, track it.
    if (sourceLink && controllerLink) {
      this.memory.controllerLink = {
        a: sourceLink ? sourceLink.id : null,
        b: controllerLink ? controllerLink.id : null
      };
    } else {
      delete this.memory.controllerLink;
    }
  }
}
