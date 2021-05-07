import { ErrorMapper } from "utils/ErrorMapper";
import { Harvester } from "roles/harvester";

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time}`);

  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }

  const spawn1 = Game.spawns.Spawn1;

  // Get harvesters
  const currentHarvesters = _.filter(Game.creeps, (creep: Creep) => creep.memory.role === Harvester.role);
  if (currentHarvesters.length < Harvester.max && !spawn1.spawning) {
    Harvester.create(spawn1);
  }

  // Visualize spawning
  if (spawn1.spawning) {
    const spawningCreep = Game.creeps[spawn1.spawning.name];
    spawn1.room.visual.text("🛠️" + spawningCreep.memory.role, spawn1.pos.x + 1, spawn1.pos.y, {
      align: "left",
      opacity: 0.8
    });
  }

  // Run creeps
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];

    if (creep.memory.role === "harvester") {
      Harvester.run(creep);
    }
  }
});
