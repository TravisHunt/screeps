import { palette } from "path.palette";

export const Harvester = {
  role: "harvester",
  max: 2,

  run(creep: Creep): void {
    if (creep.store.energy < creep.store.getCapacity()) {
      const sources = creep.room.find(FIND_SOURCES);
      if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(sources[0], { visualizePathStyle: { stroke: palette.harvest } });
      }
    } else {
      const targets = creep.room.find(FIND_STRUCTURES, {
        filter: structure => {
          return (
            (structure.structureType === STRUCTURE_EXTENSION ||
              structure.structureType === STRUCTURE_SPAWN ||
              structure.structureType === STRUCTURE_TOWER) &&
            structure.energy < structure.energyCapacity
          );
        }
      });
      if (targets.length > 0) {
        if (creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0], { visualizePathStyle: { stroke: palette.transfer } });
        }
      } else {
        // Do we have any containers waiting to be built?
        const containerSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES, {
          filter: { structureType: STRUCTURE_CONTAINER }
        });

        if (containerSites.length && creep.build(containerSites[0]) === ERR_NOT_IN_RANGE) {
          creep.moveTo(containerSites[0], { visualizePathStyle: { stroke: palette.build } });
        } else if (creep.room.controller && creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
          // Upgrade controller if nothing else to do
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: palette.upgrade } });
        } else {
          // Make it known that I'm waiting
          creep.memory.working = false;
        }
      }
    }
  },

  create(spawn: StructureSpawn): void {
    const name = `Harvester${Game.time}`;
    console.log("Spawning new harvester: " + name);

    spawn.spawnCreep([WORK, CARRY, MOVE], name, { memory: { role: this.role, working: false } });
  }
};
