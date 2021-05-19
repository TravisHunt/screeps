interface Memory {
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

type BuildSite = RoomPosition | RoomPosition[];
type BuildType = "road" | "ext";

interface PathDestination {
  x: number;
  y: number;
  range: number;
  roomName: string;
}

interface BuildJob {
  id: number;
  type: BuildType;
  pathStrings: string[];
  complete: boolean;
  origin?: RoomPosition;
  goal?: PathDestination;
}

interface BuildSchedule {
  jobs: BuildJob[];
  jobCounter: number;
  state: RoomBuildMasterList;
  highPriorityBuild?: Id<ConstructionSite>;
}

interface RoomBuildMasterList {
  roadFromSpawnToCtrl: RoomBuildJobState;
  roadFromSpawnToEnergySources: RoomBuildJobState;
}

interface RoomBuildJobState {
  inprogress: boolean;
  complete: boolean;
  jobId?: number;
}
