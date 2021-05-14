import { v4 } from "uuid";

/* eslint-disable no-underscore-dangle */
export default class BuildManager {
  public static readonly role = "builder";
  public readonly creepMax: number;
  public builders: Creep[];
  private room: Room;

  public constructor(room: Room, max: number) {
    this.room = room;
    this.creepMax = max;
    this.builders = _.filter(Game.creeps, (creep: Creep) => creep.memory.role === BuildManager.role);

    // Find build schedule in Memory. Create one if none found.
    if (!this.schedule) this.schedule = BuildManager.initBuildSchedule();

    // Do we have the max amount of extensions?
    // TODO

    // If we haven't started building a road from spawn to ctlr
    this.buildRoadSpawnToCtrl();

    // Clear out completed jobs
    this.schedule.jobs = this.schedule.jobs.filter(j => !j.complete);
  }

  public get schedule(): BuildSchedule {
    return Memory.buildSchedules[this.room.name];
  }

  public set schedule(schedule: BuildSchedule) {
    Memory.buildSchedules[this.room.name] = schedule;
  }

  private static initBuildSchedule(): BuildSchedule {
    return {
      jobs: [],
      state: {
        roadFromSpawnToCtrl: { inprogress: false, complete: false }
      }
    };
  }

  private getJob(jobId: Id<BuildJob>): BuildJob | undefined {
    return this.schedule.jobs.find(j => j.id === jobId);
  }

  public run(): void {
    // Spawn builder if we need one
    const spawn = this.room.find(FIND_MY_SPAWNS)[0];
    if (this.schedule.jobs.length && this.builders.length < this.creepMax && !spawn.spawning) {
      BuildManager.create(spawn);
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
        const jobPath = Room.deserializePath(job.pathStr);

        for (const step of jobPath) {
          const found = this.room.lookForAt(LOOK_CONSTRUCTION_SITES, step.x, step.y);
          if (found.length) {
            buildSite = found[0];
            break;
          }
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

  public static create(spawn: StructureSpawn): void {
    const name = `Builder${Game.time}`;
    console.log("Spawning new builder: " + name);
    spawn.spawnCreep([WORK, CARRY, MOVE], name, { memory: { role: this.role, building: false } });
  }

  private createBuildJob(type: BuildType, path: PathStep[], origin: RoomPosition, goal: PathDestination): BuildJob {
    // TODO: this is currently only set up for road-style jobs
    const job: BuildJob = {
      id: v4() as Id<BuildJob>,
      type,
      pathStr: Room.serializePath(path),
      complete: false,
      origin,
      goal
    };

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

    const job = this.createBuildJob("road", path, from, goal);

    // Queue job and its construction sites
    this.schedule.jobs.push(job);
    path.forEach(step => {
      this.room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
    });

    // Queue job
    return job;
  }

  public buildRoadSpawnToCtrl(): void {
    const roadFromSpawnToCtrl = this.schedule.state.roadFromSpawnToCtrl;
    if (!roadFromSpawnToCtrl.inprogress && !roadFromSpawnToCtrl.complete) {
      if (!this.room.controller) throw new Error("Room has no controller");

      // TODO: handle multiple spawns?
      const spawn = this.room.find(FIND_MY_SPAWNS)[0];

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
