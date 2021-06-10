/**
 * Defines Types, Constants, and Interfaces used by the MaintenanceService.
 */

/** Maintenance task successful */
export const MaintenanceOk = "OK";
/** Maintenance task was given an invalid room name */
export const InvalidRoomError = "INVALID_ROOM_ERROR";
/** Maintenance task was given an ID of an invalid task owner */
export const InvalidOwnerError = "INVALID_OWNER_ERROR";
/** Maintenance is not tracked in this room */
export const MaintenanceNotTrackedError = "MAINTENANCE_NOT_TRACKED";
/** Maintenance request was already submitted */
export const RequestAlreadySubmittedError = "REQUEST_ALREADY_SUBMITTED_ERROR";

export type AnyMaintenanceStatus =
  | typeof MaintenanceOk
  | typeof InvalidRoomError
  | typeof InvalidOwnerError
  | typeof MaintenanceNotTrackedError
  | typeof RequestAlreadySubmittedError;

export interface MaintenanceStatus {
  code: AnyMaintenanceStatus;
  message: string;
}
