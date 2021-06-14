export default class RepairTask<T> implements IRepairTask<T> {
  public id: Id<T>;
  public target: T;

  public constructor(task: IRepairTask<T>) {
    this.id = task.id;
    const target = Game.getObjectById(this.id);
    if (!target) throw new Error(`Repair task ${this.id} has no game object`);
    this.target = target;
  }
}
