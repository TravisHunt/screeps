interface RoomMemory {
  state: RoomState;
  buildQueue: BuildMemory[];
  currentBuild?: BuildMemory;
  harvestQueue: [Id<Creep>, number][];
  deliveryQueue: ResourceRequestFromBucket[];
  courierNames: string[];
  managedSources: ManagedStationMemory<Source>[];
  spawnIds: Id<StructureSpawn>[];
  sourceIds: Id<Source>[];
  containerIds: Id<StructureContainer>[];
  storageIds: Id<StructureStorage>[];
  terminalIds: Id<StructureTerminal>[];
  outposts: Record<string, OutpostMemory>;
}

interface ResourceRequestOpts {
  amount?: number;
  ignoreStores?: boolean;
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
