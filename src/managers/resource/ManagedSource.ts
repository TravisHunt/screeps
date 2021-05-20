export default class ManagedSource {
  public source: Source;
  private _sourceId: Id<Source>;
  private _positions: OccupiablePosition[];

  public constructor(memory: ManagedSourceMemory) {
    this._sourceId = memory.sourceId;
    this._positions = memory.harvestPositions;

    const source = Game.getObjectById(this._sourceId);
    if (source) this.source = source;
    else throw new Error(`ManagedSource: no source with id ${this._sourceId}`);
  }

  public get positions(): OccupiablePosition[] {
    return this._positions;
  }

  public get unoccupiedPositions(): OccupiablePosition[] {
    return this._positions.filter(p => !p.occuiped);
  }

  public get occupiedPositions(): OccupiedPosition[] {
    return this._positions.filter(p => p.occuiped) as OccupiedPosition[];
  }

  public getAvailablePosition(): OccupiablePosition | undefined {
    for (const pos of this._positions) {
      if (!pos.occuiped) return pos;
    }
    return undefined;
  }

  public run(): StationInsights {
    const [done, dead] = this.clean();
    this.operate();

    return {
      cleanUp: { done, dead }
    };
  }

  private clean(): [number, number] {
    let corpseCount = 0;
    let finishedCount = 0;

    this._positions.forEach(pos => {
      if (pos.occuiped) {
        const creep = Game.getObjectById(pos.occuiped.creepId);
        if (creep) {
          // Check harvest job progress. If we're done, clear out the slot
          // so it can be reassigned.
          pos.occuiped.progress =
            creep.store.getUsedCapacity(RESOURCE_ENERGY) - pos.occuiped.start;

          if (pos.occuiped.progress >= pos.occuiped.requested) {
            // Harvest job is done. Clear out position.
            pos.occuiped = undefined;
            finishedCount++;
          }
        } else {
          pos.occuiped = undefined;
          corpseCount++;
        }
      }
    });

    return [finishedCount, corpseCount];
  }

  private operate(): void {
    for (const pos of this.occupiedPositions) {
      const creep = Game.getObjectById(pos.occuiped.creepId);
      if (!creep) continue;

      // Has the creep made it to their assigned harvest position?
      if (creep.pos.isEqualTo(pos.x, pos.y)) {
        // Continue harvesting for this tick
        creep.harvest(this.source);
      } else {
        // Move to the harvest position using the serialized path string
        // generated when the harvest position was assigned.
        switch (creep.moveByPath(pos.occuiped.path)) {
          case ERR_TIRED:
            creep.say(`Fatigued: ${creep.fatigue}`);
            break;
          case ERR_NO_BODYPART:
            creep.say("No MOVE parts!");
            break;
          case ERR_NOT_FOUND:
          case ERR_INVALID_ARGS:
            // Fall back to using moveTo to reach harvest position
            // to avoid stalling out.
            creep.say("BAD PATH");
            creep.moveTo(pos.x, pos.y);
        }
      }
    }
  }
}