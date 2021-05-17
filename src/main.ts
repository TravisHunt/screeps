import BuildManager from "managers/build.manager";
import HarvestManager from "managers/harvest.manager";
import { ErrorMapper } from "utils/ErrorMapper";
import UpgradeManager from "managers/upgrade.manager";

const HARVESTER_MAX = 2;
const BUILDER_MAX = 2;
const REPAIRMAN_MAX = 1;

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }

  // Init build schedules table
  if (!Memory.buildSchedules) Memory.buildSchedules = {};

  const spawn1 = Game.spawns.Spawn1;

  // Get upgraders
  const currentUpgraders = _.filter(Game.creeps, (creep: Creep) => creep.memory.role === UpgradeManager.role);
  const upgradeManager = new UpgradeManager(1, currentUpgraders);
  if (upgradeManager.openPositions > 0) {
    UpgradeManager.create(spawn1);
  }

  // Visualize spawning
  if (spawn1.spawning) {
    const spawningCreep = Game.creeps[spawn1.spawning.name];
    spawn1.room.visual.text("🛠️" + spawningCreep.memory.role, spawn1.pos.x + 1, spawn1.pos.y, {
      align: "left",
      opacity: 0.8
    });
  }

  // Run harvesters
  const harvestManager = new HarvestManager(spawn1.room, HARVESTER_MAX);
  harvestManager.run();

  // Run builders
  const buildManager = new BuildManager(spawn1.room, BUILDER_MAX, REPAIRMAN_MAX);
  buildManager.run();

  // Run creeps
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];

    if (creep.memory.role === UpgradeManager.role) {
      UpgradeManager.doYourJob(creep);
    }
  }
});
