/**
 * Defines Types, Constants, and Interfaces used by the MaintenanceService.
 */

import Queue from "utils/Queue";

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

export interface MaintenanceRequest {
  roomName: string;
  type: "personnel" | "service";
  ownerTag: string;
  creepCount: number;
}

export interface MaintenanceServiceMemory {
  roomName: string;
  requestQueue: MaintenanceRequest[];
}

export interface RoomMaintenance {
  roomName: string;
  requestQueue: Queue<MaintenanceRequest>;
}
