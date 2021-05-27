interface WithdrawOpts {
  amount?: number;
  ignoreStores?: boolean;
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
  path: string;
}

interface ResourceManagerMemory {
  sources: ManagedStationMemory<Source>[];
  containers: Id<StructureContainer>[];
  storageUnits: Id<StructureStorage>[];
  harvestQueue: [Id<Creep>, number][];
  deliveryQueue: ResourceRequest[];
  courierNames: string[];
}

interface StationInsights {
  cleanUp: { done: number; dead: number };
}
