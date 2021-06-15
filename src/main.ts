import "prototypes/AllImports";
import { ErrorMapper } from "utils/ErrorMapper";
import RoomManager from "managers/room/RoomManager";
import MaintenanceService from "services/MaintenanceService";
import StatisticsService from "services/StatisticsServices";
import { USERNAME } from "screeps.constants";

const currentVersion = "0.0.2";

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  let shouldMigrate = false;
  if (!Memory.version) Memory.version = "0.0.1";
  if (Memory.version !== currentVersion) {
    shouldMigrate = true;
    Memory.version = currentVersion;
  }

  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }

  // Init memory tables for various processes
  if (!Memory.logs) Memory.logs = [];
  if (!Memory.rooms) Memory.rooms = {};
  if (!Memory.maintenance) Memory.maintenance = {};

  const roomManagers: RoomManager[] = [];

  for (const name in Game.rooms) {
    // If this is a newly visible room, we check to see if we want to manage.
    if (name in Memory.rooms === false) {
      const room = Game.rooms[name];
      // To track, we need to be the owner of the controller
      if (room.controller && room.controller.owner) {
        if (room.controller.owner.username === USERNAME) {
          roomManagers.push(new RoomManager(name, { migrate: shouldMigrate }));
        }
      }
    } else {
      roomManagers.push(new RoomManager(name, { migrate: shouldMigrate }));
    }
  }

  roomManagers.forEach(rm => rm.run());

  // Run maintenance jobs and process maintenance requests
  const maintenanceService = MaintenanceService.getInstance();
  maintenanceService.run();

  const statsService = StatisticsService.getInstance();
  statsService.run();
});
