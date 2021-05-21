import Queue from "utils/Queue";
import * as constants from "screeps.constants";

export default class HarvestQueue extends Queue<[Id<Creep>, number]> {
  public constructor(queue: [Id<Creep>, number][] = [], max = -1) {
    super(queue, max);
  }

  public enqueue(item: [Id<Creep>, number]): number {
    const retVal = super.enqueue(item);

    if (constants.debug)
      console.log(`Harvest Queue | ADD | ${item[0]}:${item[1]}`);

    return retVal;
  }

  public containsCreep(creepId: Id<Creep>): boolean {
    const found = this.queue.filter(x => x[0] === creepId);
    return found.length > 0;
  }
}
