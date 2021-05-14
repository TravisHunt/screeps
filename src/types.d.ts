interface Memory {
  buildSchedules: Record<string, BuildSchedule>;
}

interface CreepMemory {
  role: string;
  working?: boolean;
  upgrading?: boolean;
  building?: boolean;
  jobId?: Id<BuildJob>;
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
  id: Id<this>;
  type: BuildType;
  pathStr: string;
  complete: boolean;
  origin?: RoomPosition;
  goal?: PathDestination;
}

interface BuildSchedule {
  jobs: BuildJob[];
  state: RoomBuildMasterList;
}

interface RoomBuildMasterList {
  roadFromSpawnToCtrl: RoomBuildJobState;
}

interface RoomBuildJobState {
  inprogress: boolean;
  complete: boolean;
  jobId?: Id<BuildJob>;
}
