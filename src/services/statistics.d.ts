interface IStatistics {
  rooms: Record<string, IRoomStatistics>;
}

interface IRoomStatistics {
  roomName: string;

  /**
   * Dictionary containing usage data for each storage in this room.
   * Key: storage ID. Value: Storage usage object.
   */
  storage: Record<string, IStorageStatistics>;
}

type ResourceStats = Record<ResourceConstant, Record<string, IResourceUsage>>;

interface IStorageStatistics {
  /**
   * Dictionary containing usage data for resource types stored in this storage.
   * Key: Resource constant. Value: Dictionary\<creep role, resource usage\>.
   */
  resource: ResourceStats;
}

interface IResourceUsage {
  in: number;
  out: number;
}
