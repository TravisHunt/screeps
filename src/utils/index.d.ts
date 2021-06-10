interface IQueue<Type> {
  readonly queue: Type[];
  readonly length: number;
  enqueue(item: Type): number;
  dequeue(): Type | undefined;
  isEmpty(): boolean;
  isFull(): boolean;
  peek(): Type | undefined;
  contains(item: Type): boolean;
}
