export const RoleBuilder = "builder";
export const RoleCourier = "courier";
export const RoleHarvester = "harvester";
export const RoleMaintainer = "maintainer";

export type AnyCreepRole =
  | typeof RoleBuilder
  | typeof RoleCourier
  | typeof RoleHarvester
  | typeof RoleMaintainer;
