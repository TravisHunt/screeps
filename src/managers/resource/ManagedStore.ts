import ManagedStation from "./ManagedStation";
import { StoreStructure } from "utils/typeGuards";

export default class ManagedStoreStructure extends ManagedStation<StoreStructure> {
  public constructor(memory: ManagedStationMemory<StoreStructure>) {
    super(memory);
  }

  public get store(): StoreStructure {
    return this.station;
  }

  public run(): StationInsights {
    return {
      cleanUp: { done: 0, dead: 0 }
    };
  }
}
