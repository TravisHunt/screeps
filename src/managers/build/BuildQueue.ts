import Build from "managers/build/Build";
import Queue from "utils/Queue";

export default class BuildQueue extends Queue<BuildMemory> {
  public constructor(queue: BuildMemory[] = [], max = -1) {
    super(queue, max);
  }

  public contains(mem: BuildMemory): boolean {
    return this.containsWithId(mem.id);
  }

  public containsWithId(id: number): boolean {
    const found = this.queue.find(x => x.id === id);
    return found !== undefined;
  }

  public containsRequest(request: BuildRequest): boolean {
    const byType = this.queue.filter(x => x.type === request.type);
    if (!byType.length) return false;

    let match = false;
    const requestHash = Build.generateBuildId(request.positions);
    for (const queued of byType) {
      if (queued.id === requestHash) {
        match = true;
        break;
      }
    }

    return match;
  }
}
