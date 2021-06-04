import { ErrorMapper } from "utils/ErrorMapper";
import RoomManager from "managers/room/RoomManager";

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

  const roomManagers: RoomManager[] = [];

  for (const room in Game.rooms) {
    roomManagers.push(new RoomManager(room, { migrate: shouldMigrate }));
  }

  roomManagers.forEach(rm => rm.run());
});
