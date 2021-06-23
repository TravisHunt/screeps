interface SourceMemory {
  linkId?: Id<StructureLink>;
  harvestPositions: IHarvestPosition[];
}

interface ISource extends IRoomObject, SourceMemory {
  link: StructureLink | null;
  readonly availableHarvestPositions: IHarvestPosition[];
  readonly energy: number;
  readonly energyCapacity: number;
  readonly ticksToRegeneration: number;
}

interface ISourceWrapper extends ISource {
  readonly source: Source;

  /**
   * Locates positions adjacent to the source that can be used as a harvest
   * position, but currently are not being utilized.
   */
  findUnusedHarvestPositions(): IHarvestPosition[];

  /**
   * Returns roads on harvest positions that need repaired.
   */
  harvestPositionRepairs(): StructureRoad[];
}
