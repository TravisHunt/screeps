interface Memory {
  version: string;
  statistics: IStatistics;
  logs: string[];
  rooms: Record<string, RoomMemory>;
  spawns: SpawnLedger;
  maintenance: Record<string, MaintenanceServiceMemory>;
  storageService: StorageServiceMemory;
  sourceService: SourceServiceLookupMemory;
  energyOrderHistory: PriceHistory;
}

interface StorageServiceMemory {
  [x: string]: Id<StructureStorage>[];
}

// #region Source Service
interface SourceServiceLookupMemory {
  [roomName: string]: SourceServiceRoomMemory;
}

interface SourceServiceRoomMemory {
  roomName: string;
  maintainers: string[];
  sources: SourceLookupMemory;
}

interface SourceLookupMemory {
  [sourceId: string]: SourceMemory;
}

interface ISourceServiceLookup {
  [roomName: string]: ISourceServiceRoom;
}

interface ISourceServiceRoom {
  roomName: string;
  maintainers: Creep[];
  sources: ISourceLookup;
}

interface ISourceLookup {
  [sourceId: string]: ISourceWrapper;
}
// #endregion Source Service

interface IOccupiablePosition extends RoomPosition {
  /**
   * A lock used to indicate that the position has been given to a creep for
   * its desired use. The creep should return the lock to whichever service
   * granted it when done.
   */
  locked: boolean;
}

interface IHarvestPosition extends IOccupiablePosition {
  sourceId: Id<Source>;
}

interface IHarvestLock extends RoomPosition {
  sourceId: Id<Source>;
}

interface CreepMemory {
  role: string;
  harvesting?: boolean;
  renewing?: boolean;
  balancing?: boolean;
  jobId?: number;
  buildTarget?: Id<ConstructionSite>;
  origin?: string;
  contract?: ResourceDeliveryContract;
  ownerTag?: string;
  repairTargetId?: Id<AnyStructure>;
  harvestLock?: IHarvestLock;
}

interface SpawnLedger {
  [spawnName: string]: SpawnMemory;
}
interface SpawnMemory {
  spawnName: string;
  renewalQueue: string[];
}

interface BuildTracking {
  buildQueue: BuildMemory[];
  currentBuild?: BuildMemory;
}

interface ResourceTracking {
  harvestQueue: [Id<Creep>, number][];
  deliveryQueue: ResourceRequestFromBucket[];
  courierNames: string[];
}

interface BuildMemory {
  id: number;
  type: BuildableStructureConstant;
  roomName: string;
  siteIds: Id<ConstructionSite>[];
  positions: RoomPosition[];
  complete: boolean;
}

interface BuildRequest {
  type: BuildableStructureConstant;
  positions: RoomPosition[];
}

interface BuildSchedule {
  currentBuildMemory?: BuildMemory;
  buildQueue: BuildMemory[];
}

interface RoomBuildJobState {
  inprogress: boolean;
  complete: boolean;
  jobId?: number;
}

interface HasPos {
  pos: RoomPosition;
}

interface Coordinate {
  x: number;
  y: number;
}

type LookPerimeterArray<
  T extends keyof AllLookAtTypes
> = LookForAtAreaResultArray<AllLookAtTypes[T], T>;

interface IRepairTask<T> {
  id: Id<T>;
}

type RenewalStatusNone = "none";
type RenewalStatusWaiting = "waiting";
type RenewalStatusRenewing = "renewing";
type RenewalStatus =
  | RenewalStatusNone
  | RenewalStatusWaiting
  | RenewalStatusRenewing;
