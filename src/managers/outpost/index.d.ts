interface OutpostManagerMemory {
  outposts: OutpostMemory[];
}

interface OutpostMemory {
  name: string;
  range: number;
  perimeter: Perimeter;
  base: RoomPosition;
  spawnName: string | undefined;
  containerIds: Id<StructureContainer>[];
  rampartIds: Id<StructureRampart>[];
  towerIds: Id<StructureTower>[];
  wallIds: Id<StructureWall>[];
  attendantNames: string[];
}

interface ResourceRequestFromBucket {
  bucketId: Id<AnyStoreStructure>;
  type: ResourceConstant;
  amount: number;
}

interface ResourceDeliveryContract extends ResourceRequestFromBucket {
  delivered: number;
}

interface Perimeter {
  x: { min: number; max: number };
  y: { min: number; max: number };
}
