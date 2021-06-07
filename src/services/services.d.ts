interface MaintenanceRequest {
  roomName: string;
  type: "personnel" | "service";
  ownerTag: string;
  creepCount: number;
}

interface MaintenanceServiceMemory {
  roomName: string;
  requestQueue: MaintenanceRequest[];
}

declare const InvalidRoomError: InvalidRoomError;
declare const InvalidOwnerError: InvalidOwnerError;
declare const MaintenanceNotTrackedError: MaintenanceNotTrackedError;
declare const RequestAlreadySubmittedError: RequestAlreadySubmittedError;

type InvalidRoomError = "INVALID_ROOM_ERROR";
type InvalidOwnerError = "INVALID_OWNER_ERROR";
type MaintenanceNotTrackedError = "MAINTENANCE_NOT_TRACKED";
type RequestAlreadySubmittedError = "REQUEST_ALREADY_SUBMITTED_ERROR";

type AnyMaintenanceError =
  | InvalidRoomError
  | InvalidOwnerError
  | MaintenanceNotTrackedError
  | RequestAlreadySubmittedError;

interface MaintenanceError extends Error {
  code: AnyMaintenanceError;
}

interface MaintenanceErrorConstructor extends ErrorConstructor {
  new (type: AnyMaintenanceError, message?: string): MaintenanceError;
  (type: AnyMaintenanceError, message?: string): MaintenanceError;
  readonly prototype: MaintenanceError;
}

declare const MaintenanceError: MaintenanceErrorConstructor;
