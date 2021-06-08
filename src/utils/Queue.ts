export default class Queue<Type> {
  private _queue: Type[];
  private max: number;

  /**
   * Generic Queue data structure that can accept any type of object.
   * @param queue - An Array of typed values.
   * @param max - Max number of items in queue. No limit if not provided.
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

  /**
   * Adds the item to the back of the queue.
   * @param item - Item to be added.
   * @returns The number of items in the queue. -1 if empty.
   */
  public enqueue(item: Type): number {
    let ret = -1;

    // Enqueue if either is true:
    // A) No maximum was set, or
    // B) The number of items is less than the set maximum
    if (this.max < 0 || this._queue.length < this.max) {
      this._queue.push(item);
      ret = this._queue.length;
    }

    return ret;
  }

  /**
   * Removes and returns the first item in the queue.
   * @returns First item in the queue.
   */
  public dequeue(): Type | undefined {
    const item = this._queue.shift();
    return item;
  }

  /**
   * Checks if the queue is empty.
   * @returns True if the queue is empty, otherwise False.
   */
  public isEmpty(): boolean {
    return this._queue.length === 0;
  }

  /**
   * Checks if the queue has a number of items equal to the set maximum
   * @returns True if the queue is full, otherwise False.
   */
  public isFull(): boolean {
    return this.max > -1 && this._queue.length === this.max;
  }

  /**
   * Peeks at the first item in the queue without dequeuing.
   * @returns The first item in the queue.
   */
  public peek(): Type | undefined {
    return this.isEmpty() ? undefined : this._queue[0];
  }

  /**
   * Checks if this item is anywhere within the queue.
   * @param item - An item of the type this queue handles.
   * @returns True if this item is anywhere in the queue, otherwise False.
   */
  public contains(item: Type): boolean {
    return this._queue.indexOf(item) > -1;
  }
}
