interface RoomMemory {
  roomName: string;
  state: RoomState;
  buildQueue: BuildMemory[];
  currentBuild?: BuildMemory;
  deliveryQueue: ResourceRequestFromBucket[];
  courierNames: string[];
  balancerNames: string[];
  spawnIds: Id<StructureSpawn>[];
  extensionIds: Id<StructureExtension>[];
  containerIds: Id<StructureContainer>[];
  storageIds: Id<StructureStorage>[];
  rampartIds: Id<StructureRampart>[];
  towerIds: Id<StructureTower>[];
  wallIds: Id<StructureWall>[];
  outposts: Record<string, OutpostMemory>;
  upgradeLink?: Id<StructureLink>;
  storageLink?: Id<StructureLink>;
  sourceLinks: Id<StructureLink>[];
}

interface RoomConfig {
  migrate?: boolean;
  harvesterMax?: number;
  courierMax?: number;
  builderMax?: number;
  repairmanMax?: number;
  upgraderMax?: number;
}

interface ResourceRequestOpts {
  amount?: number;
  ignoreStores?: boolean;
  upgrading?: boolean;
}

interface RoomState {
  spawnAdjacentWalkways: RoomBuildJobState;
  roadFromSpawnToCtrl: RoomBuildJobState;
  roadFromSpawnToEnergySources: RoomBuildJobState;
  sourceQueueRoad: RoomBuildJobState;
  outpostRoads: Record<string, RoomBuildJobState>;
}

type ScreepsErrorCode = "SCREEPS_ERROR";
type RoomNotFoundErrorCode = "ROOM_NOT_FOUND";

type AnyScreepsErrorCode = ScreepsErrorCode | RoomNotFoundErrorCode;

interface ScreepsError extends Error {
  code: ScreepsErrorCode;
}

interface RoomNotFoundError extends Error {
  code: RoomNotFoundErrorCode;
}

interface ScreepsErrorConstructor extends ErrorConstructor {
  new (message?: string): ScreepsError;
  (message?: string): ScreepsError;
  readonly prototype: ScreepsError;
}

declare const ScreepsError: ScreepsErrorConstructor;

interface RoomNotFoundErrorConstructor extends ErrorConstructor {
  new (message?: string): RoomNotFoundError;
  (message?: string): RoomNotFoundError;
  readonly prototype: RoomNotFoundError;
}

declare const RoomNotFoundError: RoomNotFoundErrorConstructor;
