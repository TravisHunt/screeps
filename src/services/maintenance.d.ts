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

interface RoomMaintenance {
  roomName: string;
  requestQueue: IQueue<MaintenanceRequest>;
}
