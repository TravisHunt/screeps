import ManagerBase from "managers/base.manager";
import ResourceManager from "managers/resource/resource.manager";
import { palette } from "path.palette";

export default class HarvestManager extends ManagerBase {
  public static readonly roleHarvester = "harvester";
  public readonly harvesterMax: number;
  public harvesters: Creep[];
  private room: Room;
  private resourceManager: ResourceManager;

  public constructor(room: Room, harvesterMax: number, resourceManager: ResourceManager) {
    super();
    this.room = room;
    this.harvesterMax = harvesterMax;
    this.resourceManager = resourceManager;

    this.harvesters = _.filter(
      Game.creeps,
      (creep: Creep) => creep.memory.role === HarvestManager.roleHarvester && creep.room.name === this.room.name
    );
  }

  public get schedule(): BuildSchedule {
    return Memory.buildSchedules[this.room.name];
  }

  public run(): void {
    // TODO: handle multiple spawns?
    const spawn = this.room.find(FIND_MY_SPAWNS)[0];

    // Spawn harvester if needed
    this.spawnHarvesters(spawn);

    this.harvesters.forEach(harvester => {
      this.work(harvester);
    });
  }

  private work(harvester: Creep) {
    if (harvester.memory.harvesting && harvester.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      harvester.memory.harvesting = false;
    }
    if (!harvester.memory.harvesting && harvester.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      harvester.memory.harvesting = true;
      harvester.say("🔄 harvest");
    }

    if (harvester.memory.harvesting) {
      // this.resourceManager.withdraw(harvester, RESOURCE_ENERGY, { ignoreStores: true });
      const sources = harvester.room.find(FIND_SOURCES);
      if (harvester.harvest(sources[1]) === ERR_NOT_IN_RANGE) {
        harvester.moveTo(sources[1], { visualizePathStyle: { stroke: palette.harvest } });
      }
    } else {
      // Top up energy stores on structures if needed
      let structure = harvester.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: s => {
          return (
            (s.structureType === STRUCTURE_SPAWN ||
              s.structureType === STRUCTURE_EXTENSION ||
              s.structureType === STRUCTURE_TOWER) &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
        }
      });

      // If spawns, extension, and towers are good, default to containers
      if (!structure) {
        structure = harvester.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY)
        });
      }

      if (structure) {
        // Deposit energy into structure
        if (harvester.transfer(structure, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          harvester.moveTo(structure, { visualizePathStyle: { stroke: palette.transfer } });
        }
      } else {
        // No where to store energy. Do we have a high priority build target?
        if (this.schedule.highPriorityBuild) {
          const target = Game.getObjectById(this.schedule.highPriorityBuild);
          if (target && harvester.build(target) === ERR_NOT_IN_RANGE) {
            harvester.moveTo(target, { visualizePathStyle: { stroke: palette.build } });
          }
        } else if (harvester.room.controller) {
          if (harvester.upgradeController(harvester.room.controller) === ERR_NOT_IN_RANGE) {
            harvester.moveTo(harvester.room.controller, { visualizePathStyle: { stroke: palette.upgrade } });
          }
        }
      }
    }
  }

  private spawnHarvesters(spawn: StructureSpawn) {
    if (this.harvesters.length < this.harvesterMax && !spawn.spawning) {
      // TODO: get parts based on spawn capacity
      const name = `Harvester${Game.time}`;
      const parts = [WORK, CARRY, MOVE];
      console.log(`Spawning new harvester: ${name}`);
      spawn.spawnCreep(parts, name, { memory: { role: HarvestManager.roleHarvester, harvesting: false } });
    }
  }
}
