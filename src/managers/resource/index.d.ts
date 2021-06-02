interface WithdrawOpts {
  amount?: number;
  ignoreStores?: boolean;
  upgrading?: boolean;
}

interface DepositOpts {
  amount?: number;
}

interface ManagedStationMemory<Type> {
  roomName: string;
  stationId: Id<Type>;
  positions: OccupiablePosition[];
}

type Concrete<Type> = {
  [Property in keyof Type]-?: Type[Property];
};

interface OccupiablePosition {
  x: number;
  y: number;
  occuiped?: HarvestJob;
}

type OccupiedPosition = Concrete<OccupiablePosition>;

interface HarvestJob {
  creepId: Id<Creep>;
  requested: number;
  start: number;
  progress: number;
}

interface ResourceManagerMemory {
  spawns: Id<StructureSpawn>[];
  extensions: Id<StructureExtension>[];
  sources: ManagedStationMemory<Source>[];
  containers: Id<StructureContainer>[];
  storageUnits: Id<StructureStorage>[];
  harvestQueue: [Id<Creep>, number][];
  deliveryQueue: ResourceRequestFromBucket[];
  courierNames: string[];
  ctrlLink?: LinkPairMemory;
}

interface StationInsights {
  cleanUp: { done: number; dead: number };
}

interface LinkPairMemory {
  a: Id<StructureLink> | null;
  b: Id<StructureLink> | null;
}

interface LinkPair {
  a: StructureLink;
  b: StructureLink;
}
