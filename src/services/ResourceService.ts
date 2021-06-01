import {
  ERR_CREEP_SPAWNING,
  ERR_RESOURCE_NOT_IMPLEMENTED,
  ResourceReturnCode
} from "managers/resource/utils";
import SourceService from "./SourceService";

export default class ResourceService {
  private sourceService: SourceService;

  public constructor(
    room: Room,
    managed: ManagedStationMemory<Source>[],
    queue: [Id<Creep>, number][]
  ) {
    this.sourceService = new SourceService(room, managed, queue);
  }

  public run(): void {
    this.sourceService.run();
  }

  public submitResourceRequest<R extends ResourceConstant>(
    requestor: Creep,
    type: R,
    opts?: ResourceRequestOpts
  ): ResourceReturnCode {
    if (requestor.spawning) return ERR_CREEP_SPAWNING;

    switch (type) {
      case RESOURCE_ENERGY:
        return this.submitEnergyRequest(requestor, opts);
      default:
        return ERR_RESOURCE_NOT_IMPLEMENTED;
    }
  }

  /**
   * Submits a request to the Source Service for harvesting energy.
   * @param requestor - Creep requesting energy
   * @param opts - Options that shape the energy request
   * @returns
   */
  private submitEnergyRequest(
    requestor: Creep,
    opts?: ResourceRequestOpts
  ): ResourceReturnCode {
    return this.sourceService.submitRequest(requestor, opts);
  }
}
