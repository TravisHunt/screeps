import { OUTPOST_RANGE } from "screeps.constants";
import HarvestPosition from "./HarvestPosition";
import RoomObjectWrapper from "./RoomObjectWrapper";

/**
 * Wrapper class for a Source that tracks adjacent harvest positions, links,
 * and provides additional Source functionality.
 */
export default class SourceWrapper
  extends RoomObjectWrapper<Source>
  implements ISourceWrapper {
  public link: StructureLink | null = null;
  public harvestPositions: HarvestPosition[] = [];

  // #region Accessors
  public get id(): Id<Source> {
    return this.target.id;
  }

  public get source(): Source {
    return this.target;
  }

  public get availableHarvestPositions(): HarvestPosition[] {
    return this.harvestPositions.filter(p => !p.locked);
  }

  public get energy(): number {
    return this.target.energy;
  }
  public get energyCapacity(): number {
    return this.target.energyCapacity;
  }
  public get ticksToRegeneration(): number {
    return this.target.ticksToRegeneration;
  }
  // #endregion Accessors

  public constructor(src: Source, mem?: SourceMemory) {
    super(src);

    if (mem) {
      // Scan for deposit link if we haven't found one yet.
      if (!mem.linkId) {
        const link = SourceWrapper.findDepositLink(src);
        if (link) mem.linkId = link.id;
      }
      if (mem.linkId) this.link = Game.getObjectById(mem.linkId);

      this.harvestPositions = mem.harvestPositions.map(
        hp => new HarvestPosition(hp.x, hp.y, hp.roomName, src.id, hp.locked)
      );
    }
  }

  // #region Static
  /**
   * Generates memory object for Source. This scans for initial harvest
   * positions and deposit links.
   * @param src - Source to wrap
   * @returns - Generated memory object for Source
   */
  public static createMemory(src: Source): SourceMemory {
    const harvestPositions = this.findHarvestPositions(src);
    const link = SourceWrapper.findDepositLink(src);
    return {
      linkId: link ? link.id : undefined,
      harvestPositions
    };
  }

  /**
   * Gets all walkable positions adjacent to this room object.
   * @returns List of RoomPositions adjacent to the managed room object.
   */
  public static findHarvestPositions(src: Source): HarvestPosition[] {
    const walkable = src.pos
      .getAdjacent(true, true)
      .map(p => new HarvestPosition(p.x, p.y, p.roomName, src.id));

    return walkable;
  }

  /**
   * Finds an returns a StructureLink within range of the given source, if
   * one is found.
   * @param src - Source to search near
   * @returns Link within range of source if found
   */
  public static findDepositLink(src: Source): StructureLink | undefined {
    const link = src.pos
      .findMyStructuresInRange(STRUCTURE_LINK, OUTPOST_RANGE)
      .shift() as StructureLink | undefined;

    return link;
  }

  // #endregion Static

  /**
   * Scans tiles adjacent to this source and returns any found that aren't
   * currently tracked in the harvestPositions list.
   * @returns Array of unused harvest positions
   */
  public findUnusedHarvestPositions(): HarvestPosition[] {
    const untrackedPositions = SourceWrapper.findHarvestPositions(
      this.source
    ).filter(hp1 => !this.harvestPositions.find(hp2 => hp1.isEqualTo(hp2)));

    return untrackedPositions;
  }

  /**
   * Scans this source's harvest positions for damaged roads. It is important
   * to maintain these roads, as roads fully decaying may lead to a loss of
   * harvest positions.
   * @returns Roads in need of repair adjacent to this source
   */
  public harvestPositionRepairs(): StructureRoad[] {
    const roadsToRepair: StructureRoad[] = [];

    for (const hp of this.harvestPositions) {
      const road = hp.lookForStructure(STRUCTURE_ROAD);
      if (road && road.hits < road.hitsMax) {
        roadsToRepair.push(road as StructureRoad);
      }
    }

    return roadsToRepair;
  }
}
