import ManagerBase from "managers/base.manager";
import ResourceManager from "managers/resource/resource.manager";
import * as utils from "managers/resource/utils";
import * as palette from "palette";

export default class BuildManager extends ManagerBase {
  public static readonly roleBuilder = "builder";
  public static readonly roleRepairman = "repairman";
  public readonly builderMax: number;
  public readonly repairmanMax: number;
  public builders: Creep[];
  public repairmen: Creep[];
  private resourceManager: ResourceManager;

  public constructor(
    room: Room,
    builderMax: number,
    repairmanMax: number,
    resourceManager: ResourceManager
  ) {
    super(room);
    this.builderMax = builderMax;
    this.repairmanMax = repairmanMax;
    this.resourceManager = resourceManager;

    this.builders = _.filter(
      Game.creeps,
      (creep: Creep) =>
        creep.memory.role === BuildManager.roleBuilder &&
        creep.room.name === this.room.name
    );
    this.repairmen = _.filter(
      Game.creeps,
      (creep: Creep) =>
        creep.memory.role === BuildManager.roleRepairman &&
        creep.room.name === this.room.name
    );

    // Find build schedule in Memory. Create one if none found.
    this.initBuildSchedule();
  }

  public get schedule(): BuildSchedule {
    return Memory.buildSchedules[this.room.name];
  }

  public set schedule(schedule: BuildSchedule) {
    Memory.buildSchedules[this.room.name] = schedule;
  }

  private initBuildSchedule(): void {
    if (!this.schedule) {
      this.schedule = {
        jobCounter: 0,
        jobs: []
      };
    } else {
      if (!this.schedule.jobCounter) this.schedule.jobCounter = 0;
      if (!this.schedule.jobs) this.schedule.jobs = [];
    }
  }

  private getJob(jobId: number): BuildJob | undefined {
    return this.schedule.jobs.find(j => j.id === jobId);
  }

  public run(): void {
    // TODO: handle multiple spawns?
    const spawn = this.room.find(FIND_MY_SPAWNS)[0];

    // Queue job for source queue

    // Do we have the max amount of extensions?
    // TODO

    // Build road from spawn to energy sources
    this.buildRoadSpawnToEnergySources(spawn);

    // If we haven't started building a road from spawn to ctlr
    this.buildRoadSpawnToCtrl(spawn);

    // Build road for source queue
    this.buildSourceQueueRoad(spawn);

    // Clear out completed jobs
    if (this.schedule.jobs)
      this.schedule.jobs = this.schedule.jobs.filter(j => !j.complete);

    // Spawn builder if we need one
    if (this.builders.length < this.builderMax && !spawn.spawning) {
      if (this.schedule.highPriorityBuild || this.schedule.jobs.length) {
        BuildManager.createBuilder(spawn, this.room.energyCapacityAvailable);
      }
    }

    // Spawn repairman if we need one
    if (this.repairmen.length < this.repairmanMax && !spawn.spawning) {
      BuildManager.createRepairman(spawn);
    }

    // Assign jobs
    this.builders.forEach(builder => {
      // Clear completed job
      if (builder.memory.jobId) {
        const jobActive = this.schedule.jobs.find(
          j => j.id === builder.memory.jobId
        );
        if (jobActive && jobActive.complete) delete builder.memory.jobId;
      }

      if (!builder.memory.jobId && this.schedule.jobs.length) {
        // Assign to first available job
        builder.memory.jobId = this.schedule.jobs[0].id;
      }

      this.doYourJob(builder);
    });

    // Put repairmen to work
    this.repairmen.forEach(repairman => {
      this.repair(repairman);
    });
  }

  private performJob(creep: Creep): void {
    switch (creep.memory.role) {
      case BuildManager.roleBuilder:
        this.doYourJob(creep);
        break;
      case BuildManager.roleRepairman:
        this.repair(creep);
        break;
      default:
        creep.say("I Have No Role");
    }
  }

  private repair(creep: Creep): void {
    // Harvest if you have no more energy
    if (
      !creep.memory.harvesting &&
      creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0
    ) {
      creep.memory.harvesting = true;
      creep.say("🔄 harvest");
    }

    // Repair if you're at carrying capacity
    if (
      creep.memory.harvesting &&
      creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
    ) {
      creep.memory.harvesting = false;
      creep.say("🚧 repair");
    }

    if (creep.memory.harvesting) {
      this.resourceManager.withdraw(creep, RESOURCE_ENERGY);
      return;
    }

    // TOOD: Check resourceManager for roads on harvest tiles.
    const managerRepair = this.resourceManager.getInNeedOfRepair().shift();

    const target =
      managerRepair ||
      this.room
        .find(FIND_STRUCTURES, {
          filter: object => object.hits < object.hitsMax
        })
        .sort((a, b) => a.hits - b.hits)
        .shift();

    if (target && creep.repair(target) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, {
        visualizePathStyle: { stroke: palette.PATH_COLOR_REPAIR }
      });
    } else {
      const csite = creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);
      if (csite && creep.build(csite) === ERR_NOT_IN_RANGE) {
        creep.moveTo(csite, {
          visualizePathStyle: { stroke: palette.PATH_COLOR_BUILD }
        });
      }
    }
  }

  private doYourJob(creep: Creep): void {
    // TODO: make sure the creep is capable of this job

    // Harvest if you have no more energy
    if (
      !creep.memory.harvesting &&
      creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0
    ) {
      creep.memory.harvesting = true;
      creep.say("🔄 harvest");
    }

    // Build if you're at carrying capacity
    if (
      creep.memory.harvesting &&
      creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
    ) {
      // TODO: Implement "get out of the way" method
      creep.move(LEFT);
      creep.memory.harvesting = false;
      creep.say("🚧 build");
    }

    // Loop action: build site or harvest from energy source
    if (creep.memory.harvesting) {
      this.resourceManager.withdraw(creep, RESOURCE_ENERGY);
      return;
    }

    if (
      this.schedule.highPriorityBuild ||
      creep.memory.jobId ||
      creep.memory.buildTarget
    ) {
      // Find the first construction site within the job
      let buildSite: ConstructionSite | null = null;
      let job: BuildJob | undefined;

      if (this.schedule.highPriorityBuild) {
        buildSite = Game.getObjectById(this.schedule.highPriorityBuild);
      } else if (creep.memory.buildTarget) {
        buildSite = Game.getObjectById(creep.memory.buildTarget);
      } else if (creep.memory.jobId) {
        job = this.getJob(creep.memory.jobId);
        if (job) {
          for (const pStr of job.pathStrings) {
            const jobPath = Room.deserializePath(pStr);
            for (const step of jobPath) {
              const found = this.room.lookForAt(
                LOOK_CONSTRUCTION_SITES,
                step.x,
                step.y
              );
              if (found.length) {
                buildSite = found[0];
                break;
              }
            }
            if (buildSite) break;
          }
        }
      }

      if (buildSite) {
        const buildResponse = creep.build(buildSite);
        switch (creep.build(buildSite)) {
          case OK:
            creep.say("🚧 build");
            break;
          case ERR_NOT_IN_RANGE:
            creep.moveTo(buildSite, {
              visualizePathStyle: { stroke: palette.PATH_COLOR_BUILD }
            });
            break;
          case ERR_INVALID_TARGET:
            creep.say("ERR: INVALID TARGET");
            if (this.schedule.highPriorityBuild)
              delete this.schedule.highPriorityBuild;
            else if (creep.memory.buildTarget) delete creep.memory.buildTarget;
            else if (job) job.complete = true;
            break;
          default:
            creep.say(`ERR: ${buildResponse}`);
        }
      } else {
        creep.say("ERR: I HAVE NO SITE");
        if (this.schedule.highPriorityBuild)
          delete this.schedule.highPriorityBuild;
        else if (creep.memory.buildTarget) delete creep.memory.buildTarget;
        else if (job) job.complete = true;
      }
    } else {
      // No job? Pick up an unassigned construction sites
      const site = creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);
      if (site) creep.memory.buildTarget = site.id;
      else this.repair(creep);
    }
  }

  private static createBuilder(
    spawn: StructureSpawn,
    energyCapacity: number
  ): void {
    console.log("Trying to create builder...");
    const name = `Builder${Game.time}`;
    const parts =
      energyCapacity >= 550
        ? [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]
        : [WORK, CARRY, MOVE];

    if (
      spawn.spawnCreep(parts, name, {
        memory: { role: this.roleBuilder, building: false }
      }) === OK
    )
      console.log("Spawning new builder: " + name);
  }

  private static createRepairman(spawn: StructureSpawn): void {
    const name = `Repairman${Game.time}`;
    console.log("Spawning new repairman: " + name);
    spawn.spawnCreep([WORK, CARRY, MOVE], name, {
      memory: { role: this.roleRepairman, building: false }
    });
  }

  private createBuildJobObj(
    type: BuildType,
    pathStrings: string[],
    origin?: RoomPosition,
    goal?: PathDestination
  ): BuildJob {
    const job: BuildJob = {
      id: ++this.schedule.jobCounter,
      type,
      pathStrings,
      complete: false,
      origin,
      goal
    };

    return job;
  }

  private createBuildJob(
    type: BuildType,
    pathStrings: string[],
    origin?: RoomPosition,
    goal?: PathDestination
  ): BuildJob {
    const job = this.createBuildJobObj(type, pathStrings, origin, goal);
    this.schedule.jobs.push(job);
    return job;
  }

  private createMultiRoadBuildJob(paths: PathStep[][]): BuildJob {
    const pathStrings = paths.map(path => Room.serializePath(path));
    const job = this.createBuildJob("road", pathStrings);

    // Queue job's construction sites
    paths
      .reduce((acc, val) => acc.concat(val), [])
      .forEach(step => {
        this.room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
      });

    return job;
  }

  private buildRoadFromTo(
    from: RoomPosition,
    to: RoomPosition,
    opts?: FindPathOpts
  ): BuildJob {
    // Find the best path from the origin to the destination
    const path = this.room.findPath(from, to, opts);
    const goal: PathDestination = {
      x: to.x,
      y: to.y,
      range: opts && opts.range ? opts.range : 0,
      roomName: this.room.name
    };

    const job = this.createBuildJob(
      "road",
      [Room.serializePath(path)],
      from,
      goal
    );

    // Queue job's construction sites
    path.forEach(step => {
      this.room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
    });

    // Queue job
    return job;
  }

  private buildSourceQueueRoad(spawn: StructureSpawn): void {
    const jobState = this.roomState.sourceQueueRoad;
    if (!jobState)
      throw new Error("Job State Not Configured: Source Queue Road.");
    if (jobState.complete) return;

    // Road hasn't been planned
    if (!jobState.inprogress) {
      // Find queue midpoint flag
      const mid = this.room
        .find(FIND_FLAGS, {
          filter: { name: utils.FLAG_SOURCEQUEUEMIDPOINT }
        })
        .shift();

      if (!mid) {
        console.log("PLACE HARVEST QUEUE MIDPOINT TO BUILD LINE");
      } else {
        // Start queue path by getting path from spawn to mid point
        const paths: PathStep[][] = [];
        const spawnToMid = spawn.pos.findPathTo(mid.pos, {
          ignoreCreeps: true,
          ignoreRoads: true,
          ignoreDestructibleStructures: true
        });
        paths.push(spawnToMid);

        // Generate paths from midpoint to sources
        const sources = this.room.find(FIND_SOURCES);
        for (const source of sources) {
          const midToSource = mid.pos.findPathTo(source.pos, {
            ignoreCreeps: true,
            ignoreRoads: true,
            ignoreDestructibleStructures: true,
            range: 1
          });
          paths.push(midToSource);
        }

        // Add new job to this room's schedule
        const job = this.createMultiRoadBuildJob(paths);

        // Link new job to the room's state
        jobState.jobId = job.id;
        jobState.inprogress = true;
      }
    } else {
      if (!jobState.jobId)
        throw new Error("Job State Error: Job in progress without id.");

      // Job is in progress. Find job to see if it's done
      const job = this.getJob(jobState.jobId);
      if (!job) throw new Error("No job for road from spawn to sources");

      // If complete, toggle state flags and wipe ref to job since it will
      // be wiped from the schedule.
      if (job.complete) {
        jobState.inprogress = false;
        jobState.complete = true;
        delete jobState.jobId;
      }
    }
  }

  private buildRoadSpawnToEnergySources(spawn: StructureSpawn): void {
    const jobState = this.roomState.roadFromSpawnToEnergySources;
    if (!jobState)
      throw new Error("Job State Not Configured: Road from spawn to sources.");
    if (jobState.complete) return;

    // Road hasn't been planned
    if (!jobState.inprogress) {
      const sources = this.room.find(FIND_SOURCES);
      const paths: PathStep[][] = [];

      // For each source, create a job to build a road from the spawn to the source
      sources.forEach(source => {
        const path = this.room.findPath(spawn.pos, source.pos, { range: 1 });
        paths.push(path);
      });

      // Add new job to this room's schedule
      const job = this.createMultiRoadBuildJob(paths);

      // Link new job to the room's state
      jobState.jobId = job.id;
      jobState.inprogress = true;
    } else {
      if (!jobState.jobId)
        throw new Error("Job State Error: Job in progress without id.");

      // Job is in progress. Find job to see if it's done
      const job = this.getJob(jobState.jobId);
      if (!job) throw new Error("No job for road from spawn to sources");

      // If complete, toggle state flags and wipe ref to job since it will
      // be wiped from the schedule.
      if (job.complete) {
        jobState.inprogress = false;
        jobState.complete = true;
        delete jobState.jobId;
      }
    }
  }

  private buildRoadSpawnToCtrl(spawn: StructureSpawn): void {
    const jobState = this.roomState.roadFromSpawnToCtrl;
    if (!jobState.inprogress && !jobState.complete) {
      if (!this.room.controller) throw new Error("Room has no controller");

      // Add a new job to this room's schedule
      const ctrlPos = this.room.controller.pos;
      const job = this.buildRoadFromTo(spawn.pos, ctrlPos, { range: 1 });

      // Link new job to the room's state
      jobState.jobId = job.id;
      jobState.inprogress = true;
    } else if (jobState.inprogress && jobState.jobId) {
      // This road has been started, so let's check if it's complete
      const jobRoadSpawnToCtrl = this.getJob(jobState.jobId);
      if (!jobRoadSpawnToCtrl)
        throw new Error("No job for road from spawn to ctrl");

      // If complete, toggle state flags and wipe ref to job since it will be wiped
      // from the schedule.
      if (jobRoadSpawnToCtrl.complete) {
        jobState.inprogress = false;
        jobState.complete = true;
        delete jobState.jobId;
      }
    }
  }
}
