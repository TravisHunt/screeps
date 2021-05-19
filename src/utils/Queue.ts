export default class Queue<Type> {
  private _queue: Type[];
  private max: number;

  /**
   * Generic Queue data structure that can accept any type of object.
   * @param queue An Array of typed values.
   * @param max Max number of items in queue. No limit if not provided.
   */
  public constructor(queue: Type[] = [], max = -1) {
    this._queue = queue;
    this.max = max;
  }

  /**
   * Accessor for the item list.
   * @remarks
   * Use the enqueue and dequeue methods to modify the queue.
   * @returns The internal list of items.
   */
  public get queue(): Type[] {
    return this._queue;
  }

  /**
   * Number of items within the queue.
   */
  public get length(): number {
    return this._queue.length;
  }

  public enqueue(item: Type): number {
    let ret = -1;

    if (this.max < 0 || this._queue.length < this.max) {
      this._queue.push(item);
      ret = this._queue.length;
    }

    return ret;
  }

  public dequeue(): Type | undefined {
    const item = this._queue.shift();
    return item;
  }

  public isEmpty(): boolean {
    return this._queue.length === 0;
  }

  public isFull(): boolean {
    return this.max > -1 && this._queue.length === this.max;
  }

  public peek(): Type | undefined {
    return !this.isEmpty ? this._queue[0] : undefined;
  }

  public contains(item: Type): boolean {
    return this._queue.indexOf(item) > -1;
  }
}
