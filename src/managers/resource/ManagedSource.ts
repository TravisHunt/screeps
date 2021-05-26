import ManagedStation from "./ManagedStation";

export default class ManagedSource extends ManagedStation<Source> {
  public constructor(memory: ManagedStationMemory<Source>) {
    super(memory);
  }

  public get source(): Source {
    return this.station;
  }

  public run(): StationInsights {
    const [done, dead] = this.clean();
    this.operate();

    return {
      cleanUp: { done, dead }
    };
  }

  public findExpansionPositions(): RoomPosition[] {
    const terrain = this.source.room.getTerrain();
    const untracked = this.getUntrackedPositions();
    const viable: RoomPosition[] = [];

    // Scan terrain around each untracked position to determine if
    // building a road on the position would make it walkable.
    for (const pos of untracked) {
      const hasRoad = pos
        .lookFor(LOOK_STRUCTURES)
        .filter(s => s.structureType === STRUCTURE_ROAD).length;

      // If a build request for a road here was completed, or something messed
      // up and this position wasn't tracked, make sure we track it moving
      // forward.
      if (hasRoad) {
        this.positions.push({ x: pos.x, y: pos.y });
        continue;
      }

      const adjacent = ManagedSource.getAdjacentPositions(
        pos,
        this.room.name,
        false
      );

      for (const adj of adjacent) {
        const code = terrain.get(adj.x, adj.y);
        const validTerrain =
          (code & TERRAIN_MASK_WALL) === 0 && (code & TERRAIN_MASK_LAVA) === 0;

        const adjIsTracked = this.positions.filter(
          p => p.x === adj.x && p.y === adj.y
        ).length;

        // We avoid adding this position if the only adjacent walkable tile
        // is already tracked to avoid walking collision.
        // TODO: Implement anti-collision access to tucked positions?
        if (validTerrain && !adjIsTracked) {
          viable.push(pos);
          break;
        }
      }
    }

    return viable;
  }

  private getUntrackedPositions(): RoomPosition[] {
    const adjacent = ManagedSource.getAdjacentPositions(
      this.source.pos,
      this.room.name
    );
    const tracked = this.positions.map(
      p => new RoomPosition(p.x, p.y, this.room.name)
    );

    const untracked = adjacent.filter(adj => {
      let isUntracked = true;
      for (const t of tracked) {
        if (t.isEqualTo(adj)) {
          isUntracked = false;
          break;
        }
      }
      return isUntracked;
    });

    return untracked;
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
        // switch (creep.moveByPath(pos.occuiped.path)) {
        switch (creep.moveTo(pos.x, pos.y)) {
          case ERR_TIRED:
            creep.say(`Fatigued: ${creep.fatigue}`);
            break;
          case ERR_NO_BODYPART:
            creep.say("No MOVE parts!");
            break;
          // case ERR_NOT_FOUND:
          // case ERR_INVALID_ARGS:
          //   // Fall back to using moveTo to reach harvest position
          //   // to avoid stalling out.
          //   creep.say("BAD PATH");
          //   creep.moveTo(pos.x, pos.y);
        }
      }
    }
  }
}
