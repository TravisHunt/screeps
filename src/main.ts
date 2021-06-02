import { ErrorMapper } from "utils/ErrorMapper";
import BuildManager from "managers/build/build.manager";
import HarvestManager from "managers/harvest.manager";
import ResourceManager from "managers/resource/resource.manager";
import UpgradeManager from "managers/upgrade.manager";
import OutpostManager from "managers/outpost/OutpostManager";
import RoomManager from "managers/room/RoomManager";

const BUILDER_MAX = 1;
const REPAIRMAN_MAX = 2;
const UPGRADER_MAX = 2;
const COURIER_MAX = 1;

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }

  // Init memory tables for various processes
  if (!Memory.logs) Memory.logs = [];
  if (!Memory.roomState) Memory.roomState = {};
  if (!Memory.buildSchedules) Memory.buildSchedules = {};
  if (!Memory.resources) Memory.resources = {};
  if (!Memory.outposts) Memory.outposts = {};

  const roomManagers: RoomManager[] = [];

  for (const room in Game.rooms) {
    roomManagers.push(new RoomManager(room));

    if (room in Memory.roomState === false) {
      Memory.roomState[room] = {
        spawnAdjacentWalkways: { inprogress: false, complete: false },
        roadFromSpawnToCtrl: { inprogress: false, complete: false },
        roadFromSpawnToEnergySources: { inprogress: false, complete: false },
        sourceQueueRoad: { inprogress: false, complete: false },
        outpostRoads: {}
      };
    } else {
      if (!Memory.roomState[room].spawnAdjacentWalkways) {
        Memory.roomState[room].spawnAdjacentWalkways = {
          inprogress: false,
          complete: false
        };
      }
      if (!Memory.roomState[room].roadFromSpawnToCtrl) {
        Memory.roomState[room].roadFromSpawnToCtrl = {
          inprogress: false,
          complete: false
        };
      }
      if (!Memory.roomState[room].roadFromSpawnToEnergySources) {
        Memory.roomState[room].roadFromSpawnToEnergySources = {
          inprogress: false,
          complete: false
        };
      }
      if (!Memory.roomState[room].sourceQueueRoad) {
        Memory.roomState[room].sourceQueueRoad = {
          inprogress: false,
          complete: false
        };
      }
      if (!Memory.roomState[room].outpostRoads)
        Memory.roomState[room].outpostRoads = {};
    }

    if (room in Memory.outposts === false) {
      Memory.outposts[room] = { outposts: [] };
    }
  }

  const spawn1 = Game.spawns.Spawn1;

  // Visualize spawning
  if (spawn1.spawning) {
    const spawningCreep = Game.creeps[spawn1.spawning.name];
    spawn1.room.visual.text(
      "🛠️" + spawningCreep.memory.role,
      spawn1.pos.x + 1,
      spawn1.pos.y,
      {
        align: "left",
        opacity: 0.8
      }
    );
  }

  // Build and start managers for this room
  const resourceManager = new ResourceManager(spawn1.room, COURIER_MAX);
  const harvesterMax = resourceManager.harvestPositionCount;

  const outpostManager = new OutpostManager(
    Memory.outposts[spawn1.room.name],
    spawn1.room,
    resourceManager
  );

  const harvestManager = new HarvestManager(
    spawn1.room,
    harvesterMax,
    resourceManager
  );
  const buildManager = new BuildManager(
    spawn1.room,
    BUILDER_MAX,
    REPAIRMAN_MAX,
    resourceManager
  );
  const upgradeManager = new UpgradeManager(
    spawn1.room,
    UPGRADER_MAX,
    resourceManager
  );

  harvestManager.run();
  buildManager.run();
  upgradeManager.run();

  // Manage outposts
  outpostManager.run();

  // Manage resource access
  resourceManager.run();
});
