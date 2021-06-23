import Queue from "utils/Queue";
import OwnedStructureWrapper from "./OwnedStructureWrapper";

export default class Spawn
  extends OwnedStructureWrapper<StructureSpawn>
  implements IStoreStructure, IDisposable {
  public renewalQueue: Queue<Creep>;

  public static createMemory(spawn: StructureSpawn): SpawnMemory {
    return {
      spawnName: spawn.name,
      renewalQueue: []
    };
  }

  public constructor(spawn: StructureSpawn) {
    super(spawn);

    if (!spawn.memory) spawn.memory = Spawn.createMemory(spawn);

    // Sanitize our renewal queue id list by getting the creep from the Game
    // object. If we get null, then we know the creep died before renewing, so
    // we clear it from memory. We iterate backwards through the id array to
    // avoid indexing issues when we splice out dead ids.
    const lineup: Creep[] = [];
    for (let i = spawn.memory.renewalQueue.length - 1; i >= 0; i--) {
      const creep = Game.creeps[spawn.memory.renewalQueue[i]];

      // Use unshift to add creep to the front of the list, since we're
      // iterating in reverse.
      if (creep) lineup.unshift(creep);
      else spawn.memory.renewalQueue.splice(i, 1);
    }

    this.renewalQueue = new Queue<Creep>(lineup);
  }

  public get memory(): SpawnMemory {
    return this._target.memory;
  }

  public set memory(mem: SpawnMemory) {
    this._target.memory = mem;
  }

  public get name(): string {
    return this._target.name;
  }

  public get spawning(): Spawning | null {
    return this._target.spawning;
  }

  public get store(): StoreDefinition {
    return this._target.store;
  }

  public spawnCreep(
    body: BodyPartConstant[],
    name: string,
    opts?: SpawnOptions
  ): ScreepsReturnCode {
    return this._target.spawnCreep(body, name, opts);
  }

  public recycleCreep(target: Creep): ScreepsReturnCode {
    return this._target.recycleCreep(target);
  }

  public renewCreep(target: Creep): ScreepsReturnCode {
    return this._target.renewCreep(target);
  }

  public addToRenewalQueue(creep: Creep): number {
    if (this.renewalQueue.contains(creep)) return -1;
    this.renewalQueue.enqueue(creep);
    return this.renewalQueue.length - 1;
  }

  public dispose(): void {
    // Save updated renewal queue to memory.
    this.memory.renewalQueue = this.renewalQueue.queue.map(c => c.name);
  }
}
