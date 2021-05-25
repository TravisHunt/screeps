interface Memory {
  logs: string[];
  roomState: Record<string, RoomState>;
  buildSchedules: Record<string, BuildSchedule>;
  resources: Record<string, ResourceManagerMemory>;
}

interface CreepMemory {
  role: string;
  upgrading?: boolean;
  building?: boolean;
  harvesting?: boolean;
  jobId?: number;
  buildTarget?: Id<ConstructionSite>;
}

interface RoomState {
  roadFromSpawnToCtrl: RoomBuildJobState;
  roadFromSpawnToEnergySources: RoomBuildJobState;
  sourceQueueRoad: RoomBuildJobState;
}

type BuildType = "road" | "ext" | "container";

interface BuildMemory {
  id: number;
  type: BuildType;
  roomName: string;
  siteIds: Id<ConstructionSite>[];
  positions: RoomPosition[];
  complete: boolean;
}

interface BuildRequest {
  type: BuildType;
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
