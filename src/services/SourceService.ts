import HarvestQueue from "managers/resource/HarvestQueue";
import ManagedSource from "managers/resource/ManagedSource";
import {
  CREEP_ALREADY_HARVESTING,
  CREEP_IN_HARVEST_QUEUE,
  ResourceReturnCode
} from "managers/resource/utils";
import { debug } from "screeps.constants";
import * as palette from "palette";
import ManagedStation from "managers/resource/ManagedStation";

export default class SourceService {
  private memory: RoomMemory;
  private room: Room;
  private sources: Source[] = [];
  private managedSources: ManagedSource[] = [];
  private queue: HarvestQueue;

  public constructor(
    room: Room,
    sources: Source[],
    queue: HarvestQueue,
    memory: RoomMemory
  ) {
    this.memory = memory;
    this.room = room;
    this.sources = sources;
    this.queue = queue;

    // Build managed sources from memory
    for (const src of this.sources) {
      let managedMemory = this.memory.managedSources.find(
        ms => ms.stationId === src.id
      );

      // If we don't have a memory object for this source, we need to create
      // and populate one with it's occupiable positions.
      if (!managedMemory) {
        managedMemory = ManagedStation.createMemoryObj(this.room.name, src);
      }

      this.managedSources.push(new ManagedSource(managedMemory));
    }
  }

  public get harvestPositionCount(): number {
    let count = 0;

    for (const src of this.managedSources) {
      count += src.positions.length;
    }

    return count;
  }

  public run(): void {
    // Run harvest jobs for creeps occupying harvest positions.
    // Clear occupied spaces where the occupier is done harvesting.
    for (const source of this.managedSources) {
      const insight = source.run();

      if (debug) {
        const { done, dead } = insight.cleanUp;
        if (done || dead) {
          console.log(
            `Source ${source.source.id} cleaned | done: ${done}, dead: ${dead}`
          );
        }
      }
    }

    // Assign unoccupied harvest positions to creeps waiting in the queue
    if (this.queue.length) {
      // Get the number of unoccupied harvest positions
      const unoccupied = this.managedSources
        .map(ms => ms.unoccupiedPositions.length)
        .reduce((acc, val) => acc + val);

      // The number of assignments is equal to either the number of unoccupied
      // spaces or the number of creeps in the queue, whichever is smallest.
      const assignmentsOrdered = Math.min(this.queue.length, unoccupied);
      let assignmentsComplete = 0;

      // For each unoccupied position, dequeue the first creep in line and
      // assign them to an unoccupied harvest position.
      while (assignmentsComplete < assignmentsOrdered) {
        const harvestRequest = this.queue.dequeue();
        if (!harvestRequest)
          throw new Error("Harvest Queue was empty when assigning positions");

        const creep = Game.getObjectById(harvestRequest[0]);

        // If the creep died waiting in the queue, we increment the action
        // counter and continue to ensure that we don't pull more from the
        // queue then we want to.
        if (!creep) {
          assignmentsComplete++;
          continue;
        }

        // Assign the creep to the first available harvest position
        // TODO: Find best available position based on creep's position
        const harvestPos = this.getAvailableHarvestPosition();
        if (harvestPos) {
          harvestPos.occuiped = {
            creepId: harvestRequest[0],
            requested: harvestRequest[1],
            start: creep.store.getUsedCapacity(RESOURCE_ENERGY),
            progress: 0
          };

          assignmentsComplete++;
        } else {
          throw new Error(
            "No available harvest positions when one was expected"
          );
        }
      }
    }

    // TODO: I don't think this is actually necessary. Investigate if
    // the queue instance properly saves to memory.
    // Save updated harvest queue to memory
    this.memory.harvestQueue = this.queue.queue;

    // Highlight occupiable resource positions while in debug mode
    if (debug) {
      const visual = new RoomVisual(this.room.name);
      const positions = this.managedSources
        .map(s => s.positions)
        .reduce((acc, val) => acc.concat(val), []);
      for (const pos of positions) {
        const color = pos.occuiped
          ? palette.HARVEST_POS_OCCUPIED
          : palette.HARVEST_POS;
        visual.circle(pos.x, pos.y, { fill: color, radius: 0.5 });
      }
    }
  }

  public submitRequest(
    requestor: Creep,
    opts?: ResourceRequestOpts
  ): ResourceReturnCode {
    // For now, don't do anything if the creep is already harvesting or waiting.
    if (this.isHarvesting(requestor.id)) {
      return CREEP_ALREADY_HARVESTING;
    }
    if (this.isQueued(requestor.id)) {
      return CREEP_IN_HARVEST_QUEUE;
    }

    // If no amount specified with request, attempt to fill available space.
    const amount =
      opts && opts.amount && opts.amount > 0
        ? opts.amount
        : requestor.store.getFreeCapacity(RESOURCE_ENERGY);

    // Add request to the harvest queue, which is processed within the run
    // method.
    this.queue.enqueue([requestor.id, amount]);
    return CREEP_IN_HARVEST_QUEUE;
  }

  public requestBuilds(): BuildRequest[] {
    const requests: BuildRequest[] = [];

    // Gather any harvest positions that have yet to be built. Sort by harvest
    // position count so the source with the least amount of positions is
    // queued first.
    const sortedByHarvestPosCount = this.managedSources.sort(
      (a, b) => a.positions.length - b.positions.length
    );
    for (const src of sortedByHarvestPosCount) {
      const positions = src.findExpansionPositions();
      if (positions.length) {
        requests.push({ type: STRUCTURE_ROAD, positions });
      }
    }

    return requests;
  }

  public getInNeedOfRepair(): Structure<StructureConstant>[] {
    const structures: Structure<StructureConstant>[] = [];

    for (const source of this.managedSources) {
      source.positionsInNeedOfRepair.forEach(s => structures.push(s));
    }

    // TODO: handle managed containers and storage

    return structures;
  }

  /**
   * Checks if any harvest positions are currently being occupied by a creep
   * with the given Id string.
   * @param creepId - Id string of a Creep instance.
   * @returns True if the creep is harvesting, otherwise False.
   */
  public isHarvesting(creepId: Id<Creep>): boolean {
    let harvesting = false;

    for (const source of this.managedSources) {
      for (const pos of source.positions) {
        if (pos.occuiped && pos.occuiped.creepId === creepId) {
          harvesting = true;
          break;
        }
      }
    }

    return harvesting;
  }

  public isQueued(creepId: Id<Creep>): boolean {
    return this.queue.containsCreep(creepId);
  }

  private getAvailableHarvestPosition(): OccupiablePosition | undefined {
    for (const managed of this.managedSources) {
      const pos = managed.getAvailablePosition();
      if (pos) return pos;
    }

    return undefined;
  }
}
