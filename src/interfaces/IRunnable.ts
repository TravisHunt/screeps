/**
 * Defines an object or process that has a block of code that is run once
 * per game tick.
 */
export default interface IRunnable {
  run(): void;
}
