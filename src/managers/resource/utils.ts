export const OK = 0;
export const MOVING_TO_TARGET = 1;
export const CREEP_IN_HARVEST_QUEUE = 2;
export const ERR_NOT_ENOUGH_ENERGY = -1;
export const ERR_RESOURCE_NOT_IMPLEMENTED = -2;

export type ResourceReturnCode =
  | typeof OK
  | typeof MOVING_TO_TARGET
  | typeof CREEP_IN_HARVEST_QUEUE
  | typeof ERR_NOT_ENOUGH_ENERGY
  | typeof ERR_RESOURCE_NOT_IMPLEMENTED;
