export const Harvester = {
  role: "harvester",
  max: 2,

  run(creep: Creep): void {
    if (creep.carry.energy < creep.carryCapacity) {
      const sources = creep.room.find(FIND_SOURCES);
      if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(sources[0], { visualizePathStyle: { stroke: "#ffaa00" } });
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
          creep.moveTo(targets[0], { visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else {
        // Make it known that I'm waiting
        creep.memory.working = false;
      }
    }
  },

  create(spawn: StructureSpawn): void {
    const name = `Harvester${Game.time}`;
    console.log("Spawning new harvester: " + name);

    spawn.spawnCreep([WORK, CARRY, MOVE], name, { memory: { role: this.role, working: false } });
  }
};
