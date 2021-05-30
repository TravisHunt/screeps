interface Memory {
  logs: string[];
  roomState: Record<string, RoomState>;
  buildSchedules: Record<string, BuildSchedule>;
  resources: Record<string, ResourceManagerMemory>;
  outposts: Record<string, OutpostManagerMemory>;
}

interface CreepMemory {
  role: string;
  harvesting?: boolean;
  renewing?: boolean;
  jobId?: number;
  buildTarget?: Id<ConstructionSite>;
  origin?: string;
  contract?: ResourceDeliveryContract;
}

interface RoomState {
  spawnAdjacentWalkways: RoomBuildJobState;
  roadFromSpawnToCtrl: RoomBuildJobState;
  roadFromSpawnToEnergySources: RoomBuildJobState;
  sourceQueueRoad: RoomBuildJobState;
  outpostRoads: Record<string, RoomBuildJobState>;
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
