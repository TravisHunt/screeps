import Queue from "utils/Queue";

export default class HarvestQueue extends Queue<[Id<Creep>, number]> {
  public constructor(queue: [Id<Creep>, number][] = [], max = -1) {
    super(queue, max);
  }

  public containsCreep(creepId: Id<Creep>): boolean {
    const found = this.queue.filter(x => x[0] === creepId);
    return found.length > 0;
  }
}
