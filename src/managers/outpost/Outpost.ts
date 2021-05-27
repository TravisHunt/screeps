import ManagedLocation from "ManagedLocation";

export default class Outpost extends ManagedLocation {
  public name: string;
  public range: number;
  public base: RoomPosition;
  public containers: StructureContainer[] = [];
  public ramparts: StructureRampart[] = [];
  public towers: StructureTower[] = [];
  private containerIds: Id<StructureContainer>[];
  private rampartIds: Id<StructureRampart>[];
  private towerIds: Id<StructureTower>[];

  public static createMemory(flag: Flag, range: number): OutpostMemory {
    const name = flag.name;
    const base = flag.pos;

    const containerIds = Outpost.getIdsForObjectsInRange<StructureContainer>(
      base,
      range,
      STRUCTURE_CONTAINER
    );

    const rampartIds = Outpost.getIdsForObjectsInRange<StructureRampart>(
      base,
      range,
      STRUCTURE_RAMPART
    );

    const towerIds = Outpost.getIdsForObjectsInRange<StructureTower>(
      base,
      range,
      STRUCTURE_TOWER
    );

    const memory: OutpostMemory = {
      name,
      range,
      base,
      containerIds,
      rampartIds,
      towerIds
    };

    return memory;
  }

  public static getInstance(mem: OutpostMemory): Outpost {
    return new Outpost(mem);
  }

  public constructor(mem: OutpostMemory) {
    super();
    this.name = mem.name;
    this.range = mem.range;
    this.base = new RoomPosition(mem.base.x, mem.base.y, mem.base.roomName);
    this.containerIds = mem.containerIds;
    this.rampartIds = mem.rampartIds;
    this.towerIds = mem.towerIds;

    // Get all game objects with matching ids
    Outpost.fillWithGameObjects(this.containers, this.containerIds);
    Outpost.fillWithGameObjects(this.ramparts, this.rampartIds);
    Outpost.fillWithGameObjects(this.towers, this.towerIds);
  }

  public rescan(): void {
    // Scan for a container if we don't have at least one
    if (this.containerIds.length < 1) {
      this.containerIds = Outpost.getIdsForObjectsInRange<StructureContainer>(
        this.base,
        this.range,
        STRUCTURE_CONTAINER
      );
      Outpost.fillWithGameObjects(this.containers, this.containerIds);
    }

    // Always scan for updated ramparts
    this.rampartIds = Outpost.getIdsForObjectsInRange<StructureRampart>(
      this.base,
      this.range,
      STRUCTURE_RAMPART
    );
    Outpost.fillWithGameObjects(this.ramparts, this.rampartIds);

    // Scan for a tower if we don't have at least one
    if (this.towerIds.length < 1) {
      this.towerIds = Outpost.getIdsForObjectsInRange<StructureTower>(
        this.base,
        this.range,
        STRUCTURE_TOWER
      );
      Outpost.fillWithGameObjects(this.towers, this.towerIds);
    }
  }

  public requestResources(): ResourceRequest[] {
    const requests: ResourceRequest[] = [];

    // Request energy base on container level
    for (const container of this.containers) {
      const amount = container.store.getFreeCapacity(RESOURCE_ENERGY);
      if (amount > 0) {
        requests.push({
          bucketId: container.id,
          type: RESOURCE_ENERGY,
          amount
        });
      }
    }
    return requests;
  }
}
