import { ErrorMapper } from "utils/ErrorMapper";
import BuildManager from "managers/build/build.manager";
import HarvestManager from "managers/harvest.manager";
import ResourceManager from "managers/resource/resource.manager";
import UpgradeManager from "managers/upgrade.manager";

const BUILDER_MAX = 1;
const REPAIRMAN_MAX = 2;
const UPGRADER_MAX = 1;

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

  for (const room in Game.rooms) {
    if (room in Memory.roomState === false) {
      Memory.roomState[room] = {
        roadFromSpawnToCtrl: { inprogress: false, complete: false },
        roadFromSpawnToEnergySources: { inprogress: false, complete: false },
        sourceQueueRoad: { inprogress: false, complete: false },
        outpostRoads: {}
      };
    } else {
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
  }

  const spawn1 = Game.spawns.Spawn1;

  const resourceManager = new ResourceManager(spawn1.room);
  const harvesterMax = resourceManager.harvestPositionCount;

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

  // Manage resource access
  resourceManager.run();
});
