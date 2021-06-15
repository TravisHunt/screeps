import HarvestQueue from "managers/resource/HarvestQueue";
import StatisticsService from "services/StatisticsServices";
import {
  ERR_CREEP_SPAWNING,
  ERR_RESOURCE_NOT_IMPLEMENTED,
  ResourceReturnCode
} from "managers/resource/utils";
import SourceService from "./SourceService";
import * as utils from "../managers/resource/utils";
import * as palette from "../palette";
import {
  EnergyStructure,
  isEnergyStructure,
  isStoreStructure,
  StoreStructure
} from "utils/typeGuards";

export default class ResourceService {
  private memory: RoomMemory;
  private room: Room;
  private sources: Source[] = [];
  private extensions: StructureExtension[] = [];
  private containers: StructureContainer[] = [];
  private storages: StructureStorage[] = [];
  private upgradeLink?: StructureLink;
  private storageLink?: StructureLink;
  private harvestQueue: HarvestQueue;
  private sourceService: SourceService;
  private statService: StatisticsService;

  public constructor(
    room: Room,
    sources: Source[],
    extensions: StructureExtension[],
    containers: StructureContainer[],
    storages: StructureStorage[],
    harvestQueue: HarvestQueue,
    memory: RoomMemory,
    upgradeLink?: StructureLink,
    storageLink?: StructureLink
  ) {
    this.memory = memory;
    this.room = room;
    this.sources = sources;
    this.extensions = extensions;
    this.containers = containers;
    this.storages = storages;
    this.harvestQueue = harvestQueue;
    this.upgradeLink = upgradeLink;
    this.storageLink = storageLink;
    this.statService = StatisticsService.getInstance();
    this.sourceService = new SourceService(
      this.room,
      this.sources,
      this.harvestQueue,
      this.memory
    );
  }

  public get harvestPositionCount(): number {
    return this.sourceService.harvestPositionCount;
  }

  public run(): void {
    // Run harvest jobs for creeps occupying harvest positions of sources.
    this.sourceService.run();

    // Do we have an empty upgrade link?
    if (this.upgradeLink && this.upgradeLink.freeCapacity() > 0) {
      // Any full source links?
      const srcLink = this.sourceService.getReadyFullLink();
      if (srcLink) {
        srcLink.transferEnergy(this.upgradeLink);
      }
    }

    // Do we have an empty storage link?
    if (this.storageLink && this.storageLink.freeCapacity() > 0) {
      // Any full source links?
      const srcLink = this.sourceService.getReadyFullLink();
      if (srcLink) {
        srcLink.transferEnergy(this.storageLink);
      }
    }
  }

  public submitResourceRequest<R extends ResourceConstant>(
    requestor: Creep,
    type: R,
    opts?: ResourceRequestOpts
  ): ResourceReturnCode {
    if (requestor.spawning) return ERR_CREEP_SPAWNING;

    switch (type) {
      case RESOURCE_ENERGY:
        return this.submitEnergyRequest(requestor, opts);
      default:
        return ERR_RESOURCE_NOT_IMPLEMENTED;
    }
  }

  public deposit<R extends ResourceConstant>(
    creep: Creep,
    type: R,
    opts?: DepositOpts
  ): utils.ResourceReturnCode | ScreepsReturnCode {
    if (creep.spawning) return utils.ERR_CREEP_SPAWNING;
    switch (type) {
      case RESOURCE_ENERGY:
        return this.depositEnergy(creep, opts);
      default:
        console.log("ResourceManager.deposit: RESOURCE NOT IMPLEMENTED");
        return utils.ERR_RESOURCE_NOT_IMPLEMENTED;
    }
  }

  public requestBuilds(): BuildRequest[] {
    return this.sourceService.requestBuilds();
  }

  public getInNeedOfRepair(): Structure<StructureConstant>[] {
    return this.sourceService.getInNeedOfRepair();
  }

  /**
   * Submits a request to the Source Service for harvesting energy.
   * @param requestor - Creep requesting energy
   * @param opts - Options that shape the energy request
   * @returns
   */
  private submitEnergyRequest(
    requestor: Creep,
    opts?: ResourceRequestOpts
  ): ResourceReturnCode {
    // If an upgrader made the request, pull from the controller link.
    if (
      opts &&
      opts.upgrading &&
      this.upgradeLink &&
      !this.upgradeLink.empty()
    ) {
      return ResourceService.creepWithdrawFrom(
        requestor,
        RESOURCE_ENERGY,
        this.upgradeLink,
        opts && opts.amount
      );
    }

    // Check for container/storage if allowed
    const usingStore = !opts || !opts.ignoreStores;
    const amount =
      opts && opts.amount && opts.amount > 0
        ? opts.amount
        : requestor.store.getFreeCapacity(RESOURCE_ENERGY);

    if (usingStore) {
      // find first available storage unit or container with energy
      // move creep to this store
      const viableStorage = this.storages.find(
        su => su.store[RESOURCE_ENERGY] > 0
      );
      if (viableStorage) {
        return ResourceService.creepWithdrawFrom(
          requestor,
          RESOURCE_ENERGY,
          viableStorage,
          amount
        );
      }
      const viableContainer = this.containers.find(
        c => c.store[RESOURCE_ENERGY] > 0
      );
      if (viableContainer) {
        return ResourceService.creepWithdrawFrom(
          requestor,
          RESOURCE_ENERGY,
          viableContainer,
          amount
        );
      }
    }

    // If we aren't pulling from a link, container, or storage, pass the
    // request on to the harvest queue.
    return this.sourceService.submitRequest(requestor, opts);
  }

  private depositEnergy(creep: Creep, opts?: DepositOpts): ScreepsReturnCode {
    let target: AnyStoreStructure | undefined;
    let retCode: ScreepsReturnCode | undefined;

    const extWithSpace = this.extensions.filter(
      ext => ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    );

    // Deposit location priority
    // 1) Source links
    // 2) Extensions
    // 3) Storage
    const srcLinks = this.sourceService.getLinks();

    if (srcLinks.length) {
      for (const link of srcLinks) {
        if (!link.full()) {
          target = link;
          retCode = creep.transfer(
            target,
            RESOURCE_ENERGY,
            opts && opts.amount
          );
          break;
        }
      }
    }

    if (!target && !retCode) {
      if (extWithSpace.length) {
        target = extWithSpace[0];
        retCode = creep.transfer(target, RESOURCE_ENERGY, opts && opts.amount);
      } else if (
        this.room.storage &&
        this.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      ) {
        const energyBefore = creep.store[RESOURCE_ENERGY];
        target = this.room.storage;
        retCode = creep.transfer(target, RESOURCE_ENERGY, opts && opts.amount);
        if (retCode === OK) {
          const energyAfter = creep.store[RESOURCE_ENERGY];
          this.statService.logStorageWithdraw(
            target,
            creep.memory.role,
            RESOURCE_ENERGY,
            energyBefore - energyAfter
          );
        }
      }
    }

    if (!target || !retCode) return ERR_FULL;

    switch (retCode) {
      case ERR_NOT_IN_RANGE:
        creep.moveTo(target, {
          visualizePathStyle: { stroke: palette.PATH_COLOR_TRANSFER }
        });
        break;
    }

    return retCode;
  }

  /**
   * Commands the creep to harvest from the target. If the target is not within
   * range, commands the creep to move toward the target. In the event that
   * the target does not have the specified amount of the resource, the creep
   * will be given what's available.
   * @param creep - Creep instance requesting resources.
   * @param type - Type of resource to withdraw.
   * @param target - Structure to withdraw from.
   * @param amount - Amount to withdraw.
   * @returns A code indicating the status of the withdraw.
   */
  private static creepWithdrawFrom<R extends ResourceConstant>(
    creep: Creep,
    type: R,
    target: Ruin | Tombstone | EnergyStructure | StoreStructure,
    amount?: number
  ): utils.ResourceReturnCode {
    let retCode: utils.ResourceReturnCode = utils.OK;

    switch (creep.withdraw(target, type, amount)) {
      case ERR_INVALID_ARGS:
        throw new Error(
          `ResourceManager.creepWithdrawFrom: type = ${type}, amount = ${
            amount || "undefined"
          }`
        );
      case ERR_INVALID_TARGET:
        throw new Error(
          `ResourceManager.creepWithdrawFrom: Was passed target incapable of containing ${type}`
        );
      case ERR_NOT_ENOUGH_RESOURCES:
        // Is this target of a type that has a store?
        if (isEnergyStructure(target))
          creep.withdraw(target, type, target.energy);
        else if (isStoreStructure(target))
          creep.withdraw(target, type, target.store[type]);
        break;
      case ERR_NOT_IN_RANGE:
        creep.moveTo(target, {
          visualizePathStyle: { stroke: palette.PATH_COLOR_HARVEST }
        });
        retCode = utils.MOVING_TO_TARGET;
        break;
      case OK:
      case ERR_NOT_OWNER:
      case ERR_BUSY:
      case ERR_FULL:
      default:
    }

    return retCode;
  }
}
