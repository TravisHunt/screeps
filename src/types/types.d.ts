// declare const RM_OK: RM_OK;
// declare const RM_MOVING_TO_TARGET: RM_MOVING_TO_TARGET;
// declare const RM_ERR_NOT_ENOUGH_ENERGY: RM_ERR_NOT_ENOUGH_ENERGY;
// declare const RM_ERR_RESOURCE_NOT_IMPLEMENTED: RM_ERR_RESOURCE_NOT_IMPLEMENTED;

// type ResourceManagerReturnCode = OK | RM_MOVING_TO_TARGET | RM_ERR_NOT_ENOUGH_ENERGY | RM_ERR_RESOURCE_NOT_IMPLEMENTED;

// type RM_OK = 0;
// type RM_MOVING_TO_TARGET = 1;
// type RM_ERR_NOT_ENOUGH_ENERGY = -1;
// type RM_ERR_RESOURCE_NOT_IMPLEMENTED = -2;

// interface WithdrawOpts {
//   amount?: number;
//   ignoreStores?: boolean;
// }

// interface ManagedResource {
//   sourceId: Id<Source>;
//   harvestPositions: OccupiablePosition[];
// }

// interface OccupiablePosition {
//   x: number;
//   y: number;
//   occuiped: boolean;
// }

// interface ResourceManagerMemory {
//   sources: ManagedResource[];
//   containers: Id<StructureContainer>[];
//   storageUnits: Id<StructureStorage>[];
// }

// interface Memory {
//   buildSchedules: Record<string, BuildSchedule>;
//   resources: Record<string, ResourceManagerMemory>;
// }

// interface CreepMemory {
//   role: string;
//   upgrading?: boolean;
//   building?: boolean;
//   harvesting?: boolean;
//   jobId?: number;
//   buildTarget?: Id<ConstructionSite>;
// }

// type BuildSite = RoomPosition | RoomPosition[];
// type BuildType = "road" | "ext";

// interface PathDestination {
//   x: number;
//   y: number;
//   range: number;
//   roomName: string;
// }

// interface BuildJob {
//   id: number;
//   type: BuildType;
//   pathStrings: string[];
//   complete: boolean;
//   origin?: RoomPosition;
//   goal?: PathDestination;
// }

// interface BuildSchedule {
//   jobs: BuildJob[];
//   jobCounter: number;
//   state: RoomBuildMasterList;
//   highPriorityBuild?: Id<ConstructionSite>;
// }

// interface RoomBuildMasterList {
//   roadFromSpawnToCtrl: RoomBuildJobState;
//   roadFromSpawnToEnergySources: RoomBuildJobState;
// }

// interface RoomBuildJobState {
//   inprogress: boolean;
//   complete: boolean;
//   jobId?: number;
// }
