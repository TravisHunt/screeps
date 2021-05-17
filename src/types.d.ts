interface Memory {
  buildSchedules: Record<string, BuildSchedule>;
}

interface CreepMemory {
  role: string;
  working?: boolean;
  upgrading?: boolean;
  building?: boolean;
  jobId?: number;
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
