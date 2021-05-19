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
  occuiped: boolean;
}

interface ResourceManagerMemory {
  sources: ManagedResource[];
  containers: Id<StructureContainer>[];
  storageUnits: Id<StructureStorage>[];
}
