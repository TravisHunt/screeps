import Balancer from "drivers/balancer";
import BuildManager from "managers/build/build.manager";
import HarvestManager from "managers/harvest.manager";
import Outpost from "managers/outpost/Outpost";
import OutpostManager from "managers/outpost/OutpostManager";
import UpgradeManager from "managers/upgrade.manager";
import DeliveryService from "services/DeliveryService";
import ResourceService from "services/ResourceService";
import Queue from "utils/Queue";
import {
  BUILDER_MAX,
  COURIER_MAX,
  HARVESTER_MAX,
  OWNED_LINK_RANGE,
  REPAIRMAN_MAX,
  UPGRADER_MAX
} from "screeps.constants";

export default class RoomManager {
  public room: Room;
  private spawns: StructureSpawn[] = [];
  private extensions: StructureExtension[] = [];
  private containers: StructureContainer[] = [];
  private storages: StructureStorage[] = [];
  private couriers: Creep[] = [];
  private balancers: Creep[] = [];
  private outposts: Record<string, Outpost> = {};
  private deliveryQueue: Queue<ResourceRequestFromBucket>;
  private upgradeLink?: StructureLink;
  private storageLink?: StructureLink;
  private resourceService: ResourceService;
  private outpostService: OutpostManager;
  private deliveryService: DeliveryService;
  private harvestManager: HarvestManager;
  private buildManager: BuildManager;
  private upgradeManager: UpgradeManager;
  private balancer: Balancer;

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
      this.memory = RoomManager.createRoomMemoryObj(roomName);
    }

    // Migrate from old Memory structure if specified
    if (config && config.migrate) {
      RoomManager.migrateMemory(this.memory, this.room);
    }

    // Rescan for sources and store structures
    this.refreshIdCollections();

    // Check for energy links
    this.refreshLinks();

    // Build from stored ids
    this.spawns = RoomManager.idsToObjects(this.memory.spawnIds);
    this.extensions = RoomManager.idsToObjects(this.memory.extensionIds);
    this.containers = RoomManager.idsToObjects(this.memory.containerIds);
    this.storages = RoomManager.idsToObjects(this.memory.storageIds);

    this.couriers = (this.memory.courierNames || [])
      .map(name => Game.creeps[name])
      .filter(c => c !== undefined);
    this.memory.courierNames = this.couriers.map(c => c.name);

    this.balancers = (this.memory.balancerNames || [])
      .map(name => Game.creeps[name])
      .filter(c => c !== undefined);
    this.memory.balancerNames = this.balancers.map(c => c.name);

    this.deliveryQueue = new Queue<ResourceRequestFromBucket>(
      this.memory.deliveryQueue
    );

    // Build outpost instances
    for (const name in this.memory.outposts) {
      this.outposts[name] = Outpost.getInstance(this.memory.outposts[name]);
    }

    // Init service for managing access to source harvesting
    this.resourceService = new ResourceService(
      this.room,
      this.extensions,
      this.containers,
      this.storages,
      this.upgradeLink,
      this.storageLink
    );

    // Init Balancer
    this.balancer = new Balancer(
      this.room,
      this.memory,
      this.spawns,
      this.extensions,
      this.balancers,
      this.resourceService
    );

    // Init service for managing resource deliveries
    this.deliveryService = new DeliveryService(
      this.room,
      this.memory,
      this.couriers,
      (config && config.courierMax) ||
        Object.keys(this.outposts).length ||
        COURIER_MAX,
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
    this.balancer.run();

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

  private static createRoomMemoryObj(roomName: string): RoomMemory {
    return {
      roomName,
      state: {
        spawnAdjacentWalkways: { inprogress: false, complete: false },
        roadFromSpawnToCtrl: { inprogress: false, complete: false },
        roadFromSpawnToEnergySources: { inprogress: false, complete: false },
        sourceQueueRoad: { inprogress: false, complete: false },
        outpostRoads: {}
      },

      buildQueue: [],

      deliveryQueue: [],
      courierNames: [],
      balancerNames: [],

      spawnIds: [],
      extensionIds: [],
      containerIds: [],
      storageIds: [],
      rampartIds: [],
      towerIds: [],
      wallIds: [],
      sourceLinks: [],

      outposts: {}
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static migrateMemory(memory: RoomMemory, room: Room): void {
    console.log("Memory migration not implemented!");
  }

  private refreshIdCollections(): void {
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

  private refreshLinks() {
    // Controller must be >= level 5 to consider links.
    if (!this.room.controller || this.room.controller.level < 5) return;

    let upgradeLink: StructureLink | null = null;
    let storageLink: StructureLink | null = null;

    // Ensure links weren't destroyed
    if (this.memory.upgradeLink) {
      upgradeLink = Game.getObjectById(this.memory.upgradeLink);
      if (!upgradeLink) this.memory.upgradeLink = undefined;
      else this.upgradeLink = upgradeLink;
    }
    if (this.memory.storageLink) {
      storageLink = Game.getObjectById(this.memory.storageLink);
      if (!storageLink) this.memory.storageLink = undefined;
      else this.storageLink = storageLink;
    }

    // Scan for controller upgrade link
    if (!upgradeLink) {
      if (this.room.controller) {
        const link = this.room.controller.pos
          .findMyStructuresInRange(STRUCTURE_LINK, OWNED_LINK_RANGE)
          .shift() as StructureLink | undefined;
        if (link) {
          this.memory.upgradeLink = link.id;
          this.upgradeLink = link;
        }
      }
    }

    // Scan for storage link
    if (!storageLink) {
      if (this.room.storage) {
        const link = this.room.storage.pos
          .findMyStructuresInRange(STRUCTURE_LINK, OWNED_LINK_RANGE)
          .shift() as StructureLink | undefined;
        if (link) {
          this.memory.storageLink = link.id;
          this.storageLink = link;
        }
      }
    }
  }
}
