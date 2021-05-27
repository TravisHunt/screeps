interface OutpostManagerMemory {
  outposts: OutpostMemory[];
}

interface OutpostMemory {
  name: string;
  range: number;
  base: RoomPosition;
  containerIds: Id<StructureContainer>[];
  rampartIds: Id<StructureRampart>[];
  towerIds: Id<StructureTower>[];
}

interface ResourceRequest {
  bucketId: Id<AnyStoreStructure>;
  type: ResourceConstant;
  amount: number;
}

interface ResourceDeliveryContract extends ResourceRequest {
  delivered: number;
}
