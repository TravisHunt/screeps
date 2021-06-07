interface Memory {
  version: string;
  logs: string[];
  rooms: Record<string, RoomMemory>;
  maintenance: Record<string, MaintenanceServiceMemory>;
}

interface CreepMemory {
  role: string;
  harvesting?: boolean;
  renewing?: boolean;
  jobId?: number;
  buildTarget?: Id<ConstructionSite>;
  origin?: string;
  contract?: ResourceDeliveryContract;
  ownerTag?: string;
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

type RoleBuilder = "builder";
type RoleCourier = "courier";
type RoleHarvester = "harvester";
type RoleMaintainer = "maintainer";

type AnyCreepRole = RoleBuilder | RoleCourier | RoleHarvester | RoleMaintainer;

declare const RoleBuilder: RoleBuilder;
declare const RoleCourier: RoleCourier;
declare const RoleHarvester: RoleHarvester;
declare const RoleMaintainer: RoleMaintainer;
