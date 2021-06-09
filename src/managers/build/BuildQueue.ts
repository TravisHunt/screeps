import Build from "managers/build/Build";
import Queue from "utils/Queue";

/**
 * A Queue for managing scheduled Builds.
 */
export default class BuildQueue extends Queue<BuildMemory> {
  /**
   * A Queue for managing scheduled Builds.
   * @param queue - List of memory objects for Build schedule
   * @param max - Optional max number of Build's allowed
   */
  public constructor(queue: BuildMemory[] = [], max = -1) {
    super(queue, max);
  }

  /**
   * Checks build queue for a build with a matching id string.
   * @param mem - Build memory object
   * @returns True of the queue contains a Build with a matching Build ID
   */
  public contains(mem: BuildMemory): boolean {
    return this.containsWithId(mem.id);
  }

  /**
   * Checks build queue for a build with a matching id string.
   * @param id - Build id string
   * @returns True of the queue contains a Build with a matching Build ID
   */
  public containsWithId(id: number): boolean {
    const found = this.queue.find(x => x.id === id);
    return found !== undefined;
  }

  /**
   * Checks build queue for a build with the same structure type and positions.
   * @param request - An object containing Build options
   * @returns True if the queue already contains a similar request
   */
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
