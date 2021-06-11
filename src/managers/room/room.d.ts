interface RoomMemory {
  roomName: string;
  state: RoomState;
  buildQueue: BuildMemory[];
  currentBuild?: BuildMemory;
  harvestQueue: [Id<Creep>, number][];
  deliveryQueue: ResourceRequestFromBucket[];
  courierNames: string[];
  balancerNames: string[];
  managedSources: ManagedStationMemory<Source>[];
  spawnIds: Id<StructureSpawn>[];
  extensionIds: Id<StructureExtension>[];
  sourceIds: Id<Source>[];
  containerIds: Id<StructureContainer>[];
  storageIds: Id<StructureStorage>[];
  terminalIds: Id<StructureTerminal>[];
  rampartIds: Id<StructureRampart>[];
  towerIds: Id<StructureTower>[];
  wallIds: Id<StructureWall>[];
  outposts: Record<string, OutpostMemory>;
  controllerLink?: LinkPairMemory;
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
