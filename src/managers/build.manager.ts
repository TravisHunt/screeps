// import { v4 } from "uuid";

/* eslint-disable no-underscore-dangle */
export default class BuildManager {
  public static readonly roleBuilder = "builder";
  public static readonly roleRepairman = "repairman";
  public readonly builderMax: number;
  public readonly repairmanMax: number;
  public builders: Creep[];
  public repairmen: Creep[];
  private room: Room;

  public constructor(room: Room, builderMax: number, repairmanMax: number) {
    this.room = room;
    this.builderMax = builderMax;
    this.repairmanMax = repairmanMax;
    this.builders = _.filter(
      Game.creeps,
      (creep: Creep) => creep.memory.role === BuildManager.roleBuilder && creep.room.name === this.room.name
    );
    this.repairmen = _.filter(
      Game.creeps,
      (creep: Creep) => creep.memory.role === BuildManager.roleRepairman && creep.room.name === this.room.name
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
        jobs: [],
        state: {
          roadFromSpawnToCtrl: { inprogress: false, complete: false },
          roadFromSpawnToEnergySources: { inprogress: false, complete: false }
        }
      };
    } else {
      const state = this.schedule.state;
      if (!state.roadFromSpawnToCtrl) state.roadFromSpawnToCtrl = { inprogress: false, complete: false };
      if (!state.roadFromSpawnToEnergySources)
        state.roadFromSpawnToEnergySources = { inprogress: false, complete: false };
    }
  }

  private getJob(jobId: number): BuildJob | undefined {
    return this.schedule.jobs.find(j => j.id === jobId);
  }

  public run(): void {
    // TODO: handle multiple spawns?
    const spawn = this.room.find(FIND_MY_SPAWNS)[0];

    // Do we have the max amount of extensions?
    // TODO

    // Build road from spawn to energy sources
    this.buildRoadSpawnToEnergySources(spawn);

    // If we haven't started building a road from spawn to ctlr
    this.buildRoadSpawnToCtrl(spawn);

    // Clear out completed jobs
    if (this.schedule.jobs) this.schedule.jobs = this.schedule.jobs.filter(j => !j.complete);

    // Spawn builder if we need one
    if (this.schedule.jobs.length && this.builders.length < this.builderMax && !spawn.spawning) {
      BuildManager.createBuilder(spawn);
    }

    // Spawn repairman if we need one
    if (this.repairmen.length < this.repairmanMax && !spawn.spawning) {
      BuildManager.createRepairman(spawn);
    }

    // Assign jobs
    this.builders.forEach(builder => {
      // Clear completed job
      if (builder.memory.jobId) {
        const jobActive = this.schedule.jobs.find(j => j.id === builder.memory.jobId);
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
    const repairTargets = creep.room.find(FIND_STRUCTURES, {
      filter: object => object.hits < object.hitsMax
    });

    repairTargets.sort((a, b) => a.hits - b.hits);

    if (repairTargets.length > 0) {
      if (creep.repair(repairTargets[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(repairTargets[0]);
      }
    }
  }

  public doYourJob(creep: Creep): void {
    // TODO: make sure the creep is capable of this job

    // Harvest if you have no more energy
    if (creep.memory.building && creep.store.getUsedCapacity() === 0) {
      creep.memory.building = false;
      creep.say("🔄 harvest");
    }

    // Build if you're at carrying capacity
    if (!creep.memory.building && creep.store.energy === creep.store.getCapacity()) {
      creep.memory.building = true;
      creep.say("🚧 build");
    }

    // Loop action: build site or harvest from energy source
    if (creep.memory.building) {
      if (creep.memory.jobId) {
        // Find the first construction site within the job
        const job = this.getJob(creep.memory.jobId);
        if (!job) {
          creep.say("ERR: Job Not Found");
          return;
        }

        let buildSite: ConstructionSite | null = null;
        for (const pStr of job.pathStrings) {
          const jobPath = Room.deserializePath(pStr);

          for (const step of jobPath) {
            const found = this.room.lookForAt(LOOK_CONSTRUCTION_SITES, step.x, step.y);
            if (found.length) {
              buildSite = found[0];
              break;
            }
          }
          if (buildSite) break;
        }

        if (buildSite) {
          const buildResponse = creep.build(buildSite);
          switch (creep.build(buildSite)) {
            case OK:
              creep.say("🚧 build");
              break;
            case ERR_NOT_IN_RANGE:
              creep.moveTo(buildSite, { visualizePathStyle: { stroke: "#ffffff" } });
              break;
            case ERR_INVALID_TARGET:
              creep.say("ERR: INVALID TARGET");
              job.complete = true;
              break;
            default:
              creep.say(`ERR: ${buildResponse}`);
          }
        } else {
          creep.say("ERR: I HAVE NO SITE");
          job.complete = true;
        }
      } else {
        creep.say("ERR: NO JOB");
      }
    } else {
      const sources = creep.room.find(FIND_SOURCES);
      if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(sources[0], { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    }
  }

  private static createBuilder(spawn: StructureSpawn): void {
    const name = `Builder${Game.time}`;
    console.log("Spawning new builder: " + name);
    spawn.spawnCreep([WORK, CARRY, MOVE], name, { memory: { role: this.roleBuilder, building: false } });
  }

  private static createRepairman(spawn: StructureSpawn): void {
    const name = `Repairman${Game.time}`;
    console.log("Spawning new repairman: " + name);
    spawn.spawnCreep([WORK, CARRY, MOVE], name, { memory: { role: this.roleRepairman, building: false } });
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
        const found = this.room.lookForAt(LOOK_CONSTRUCTION_SITES, step.x, step.y);
        if (!found.length) this.room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
      });

    return job;
  }

  public buildRoadFromTo(from: RoomPosition, to: RoomPosition, opts?: FindPathOpts): BuildJob {
    // Find the best path from the origin to the destination
    const path = this.room.findPath(from, to, opts);
    const goal: PathDestination = {
      x: to.x,
      y: to.y,
      range: opts && opts.range ? opts.range : 0,
      roomName: this.room.name
    };

    const job = this.createBuildJob("road", [Room.serializePath(path)], from, goal);

    // Queue job's construction sites
    path.forEach(step => {
      const found = this.room.lookForAt(LOOK_CONSTRUCTION_SITES, step.x, step.y);
      if (!found.length) this.room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
    });

    // Queue job
    return job;
  }

  public buildRoadSpawnToEnergySources(spawn: StructureSpawn): void {
    const jobState = this.schedule.state.roadFromSpawnToEnergySources;
    if (!jobState) throw new Error("Job State Not Configured: Road from spawn to sources.");
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
      if (!jobState.jobId) throw new Error("Job State Error: Job in progress without id.");

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

  public buildRoadSpawnToCtrl(spawn: StructureSpawn): void {
    const roadFromSpawnToCtrl = this.schedule.state.roadFromSpawnToCtrl;
    if (!roadFromSpawnToCtrl.inprogress && !roadFromSpawnToCtrl.complete) {
      if (!this.room.controller) throw new Error("Room has no controller");

      // Add a new job to this room's schedule
      const ctrlPos = this.room.controller.pos;
      const job = this.buildRoadFromTo(spawn.pos, ctrlPos, { range: 1 });

      // Link new job to the room's state
      roadFromSpawnToCtrl.jobId = job.id;
      roadFromSpawnToCtrl.inprogress = true;
    } else if (roadFromSpawnToCtrl.inprogress && roadFromSpawnToCtrl.jobId) {
      // This road has been started, so let's check if it's complete
      const jobRoadSpawnToCtrl = this.getJob(roadFromSpawnToCtrl.jobId);
      if (!jobRoadSpawnToCtrl) throw new Error("No job for road from spawn to ctrl");

      // If complete, toggle state flags and wipe ref to job since it will be wiped
      // from the schedule.
      if (jobRoadSpawnToCtrl.complete) {
        roadFromSpawnToCtrl.inprogress = false;
        roadFromSpawnToCtrl.complete = true;
        delete roadFromSpawnToCtrl.jobId;
      }
    }
  }
}
