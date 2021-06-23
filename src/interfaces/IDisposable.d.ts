/**
 * A disposable object is one that needs to perform
 * clean up tasks at the end of every game tick.
 */
interface IDisposable {
  /** Perform end-of-tick clean up */
  dispose(): void;
}
