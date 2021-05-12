interface CreepMemory {
  role: string;
  working?: boolean;
  upgrading?: boolean;
  building?: boolean;
  job?: BuildJob;
}

interface BuildJob {
  siteId: Id<ConstructionSite>;
  complete: boolean;
}
