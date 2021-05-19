interface WithdrawOpts {
  amount?: number;
  ignoreStores?: boolean;
}

interface ManagedResource {
  sourceId: Id<Source>;
  harvestPositions: OccupiablePosition[];
}

interface OccupiablePosition {
  x: number;
  y: number;
  occuiped?: HarvestJob;
}

interface HarvestJob {
  creepId: Id<Creep>;
  requested: number;
  start: number;
  progress: number;
  path: string;
}

interface ResourceManagerMemory {
  sources: ManagedResource[];
  containers: Id<StructureContainer>[];
  storageUnits: Id<StructureStorage>[];
  harvestQueue: [Id<Creep>, number][];
}
