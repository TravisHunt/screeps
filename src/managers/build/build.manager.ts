import ManagerBase from "managers/base.manager";
import ResourceManager from "managers/resource/resource.manager";
import * as utils from "managers/resource/utils";
import * as palette from "palette";
import * as constants from "screeps.constants";
import Build from "./Build";
import BuildQueue from "./BuildQueue";

export default class BuildManager extends ManagerBase {
  public static readonly roleBuilder = "builder";
  public static readonly roleRepairman = "repairman";
  public readonly builderMax: number;
  public readonly repairmanMax: number;
  public builders: Creep[];
  public repairmen: Creep[];
  private resourceManager: ResourceManager;
  private currentBuild?: Build;
  private buildQueue: BuildQueue;

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

    this.buildQueue = new BuildQueue(this.schedule.buildQueue);
  }

  /**
   * Short-hand for Memory.buildSchedules[this.room.name]
   */
  public get schedule(): BuildSchedule {
    return Memory.buildSchedules[this.room.name];
  }
  public set schedule(schedule: BuildSchedule) {
    Memory.buildSchedules[this.room.name] = schedule;
  }

  /**
   * Initializes the build schedule at Memory.buildSchedules[this.room.name]
   */
  private initBuildSchedule(): void {
    if (!this.schedule) {
      this.schedule = {
        buildQueue: []
      };
    } else {
      if (!this.schedule.buildQueue) this.schedule.buildQueue = [];
    }
  }

  public run(): void {
    // TODO: handle multiple spawns?
    const spawn = this.room.find(FIND_MY_SPAWNS)[0];

    // Do we have the max amount of extensions?
    // TODO

    // Clear completed build. Stage next build.
    if (
      !this.schedule.currentBuildMemory ||
      this.schedule.currentBuildMemory.complete
    ) {
      this.schedule.currentBuildMemory = undefined;
      const next = this.buildQueue.dequeue();
      if (next) this.schedule.currentBuildMemory = next;
    }
    if (this.schedule.currentBuildMemory) {
      this.currentBuild = new Build(this.schedule.currentBuildMemory);
    }

    try {
      this.spawnAdjacentWalkways(spawn);
    } catch (err) {
      console.log(err);
    }

    try {
      // Build road from spawn to energy sources
      this.buildRoadSpawnToEnergySources(spawn);
    } catch (err) {
      console.log(err);
    }

    try {
      // If we haven't started building a road from spawn to ctlr
      this.buildRoadSpawnToCtrl(spawn);
    } catch (err) {
      console.log(err);
    }

    try {
      // Build road for source queue
      this.buildSourceQueueRoad(spawn);
    } catch (err) {
      console.log(err);
    }

    try {
      // Build roads to marked outposts
      this.buildOutpostRoads(spawn);
    } catch (err) {
      console.log(err);
    }

    // Queue any build jobs requested by the resource manager
    const requests = this.resourceManager.requestBuilds();
    // check if these requests have already been queued before adding
    for (const req of requests) {
      const buildMem = Build.createMemoryInstance(
        req.type,
        this.room.name,
        req.positions
      );

      // Verify that we aren't currently working this build, and that this
      // request is not in the build queue.
      const isCurrent =
        this.schedule.currentBuildMemory &&
        this.schedule.currentBuildMemory.id === buildMem.id;

      if (!isCurrent && !this.buildQueue.containsRequest(req)) {
        req.positions.forEach(pos => {
          this.room.createConstructionSite(pos.x, pos.y, req.type);
        });
        this.buildQueue.enqueue(buildMem);
      }
    }

    // Spawn builder if we need one
    const csites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
    if (
      (this.currentBuild || csites.length > 0) &&
      this.builders.length < this.builderMax &&
      !spawn.spawning
    ) {
      BuildManager.createBuilder(spawn, this.room.energyCapacityAvailable);
    }

    // Spawn repairman if we need one
    if (this.repairmen.length < this.repairmanMax && !spawn.spawning) {
      BuildManager.createRepairman(spawn);
    }

    // Assign jobs
    this.builders.forEach(builder => {
      this.doYourJob(builder, spawn, csites);
    });

    // Put repairmen to work
    this.repairmen.forEach(repairman => {
      this.repair(repairman, spawn);
    });
  }

  /**
   * Directs a creep to perform the repair job
   * @remarks TODO: Create a RepairManager
   * @param creep - Repairman
   */
  private repair(creep: Creep, spawn: StructureSpawn): void {
    // Harvest if you have no more energy
    if (
      !creep.memory.harvesting &&
      creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0
    ) {
      // Should I renew?
      const shouldRenew =
        creep.ticksToLive && creep.ticksToLive < constants.RENEW_THRESHOLD;
      const creepSize = creep.body.length;
      const creepCost = creep.body
        .map(part => BODYPART_COST[part.type])
        .reduce((total, val) => total + val);
      const renewCost = Math.ceil(creepCost / 2.5 / creepSize);
      console.log(
        `Should renew: ${shouldRenew ? "YES" : "NO"}, Renew cost: ${renewCost}`
      );
      if (shouldRenew && spawn.store[RESOURCE_ENERGY] > renewCost) {
        if (spawn.renewCreep(creep) === ERR_NOT_IN_RANGE) {
          creep.moveTo(spawn);
          return;
        }
      }

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
    const storage =
      this.room.storage &&
      this.room.storage.hits < this.room.storage.hitsMax * 0.75
        ? this.room.storage
        : undefined;
    const container = this.room
      .find(FIND_STRUCTURES, {
        filter: s =>
          s.hits < s.hitsMax * 0.75 && s.structureType === STRUCTURE_CONTAINER
      })
      .shift();

    const target =
      managerRepair ||
      storage ||
      container ||
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

  /**
   * Directs a creep to perform the build job
   * @param creep - Builder
   */
  private doYourJob(
    creep: Creep,
    spawn: StructureSpawn,
    csites: ConstructionSite[]
  ): void {
    // TODO: make sure the creep is capable of this job

    // Harvest if you have no more energy
    if (
      !creep.memory.harvesting &&
      creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0
    ) {
      // If there is no current build or build target, get recycled
      if (!this.currentBuild && !csites.length) {
        if (spawn.recycleCreep(creep) === ERR_NOT_IN_RANGE) {
          creep.moveTo(spawn);
        }
        return;
      }

      // Should I renew?
      const shouldRenew =
        creep.ticksToLive && creep.ticksToLive < constants.RENEW_THRESHOLD;
      const creepSize = creep.body.length;
      const creepCost = creep.body
        .map(part => BODYPART_COST[part.type])
        .reduce((total, val) => total + val);
      const renewCost = Math.ceil(creepCost / 2.5 / creepSize);

      if (shouldRenew && spawn.store[RESOURCE_ENERGY] > renewCost) {
        if (spawn.renewCreep(creep) === ERR_NOT_IN_RANGE) {
          creep.moveTo(spawn);
          return;
        }
      }

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

    const targetType =
      this.currentBuild && !this.currentBuild.complete
        ? "current"
        : csites.length > 0
        ? "manual"
        : "none";

    if (targetType === "current" || targetType === "manual") {
      // Find the first construction site within the job
      let buildSite: ConstructionSite | null = null;

      if (targetType === "current" && this.currentBuild) {
        if (this.currentBuild.sites.length) {
          buildSite = this.currentBuild.sites[0];
        } else {
          // Build is complete if there are no sites left.
          this.currentBuild.complete = true;
        }
      } else if (targetType === "manual") {
        buildSite = Game.getObjectById(csites[0].id);
      }

      if (buildSite) {
        const buildResponse = creep.build(buildSite);
        switch (creep.build(buildSite)) {
          case OK:
            // creep.say("🚧 build");
            break;
          case ERR_NOT_IN_RANGE:
            creep.moveTo(buildSite, {
              visualizePathStyle: { stroke: palette.PATH_COLOR_BUILD }
            });
            break;
          case ERR_INVALID_TARGET:
            if (targetType === "current" && this.currentBuild) {
              this.currentBuild.complete = true;
            }
            break;
          default:
            creep.say(`ERR: ${buildResponse}`);
        }
      } else {
        this.repair(creep, spawn);
      }
    } else {
      this.repair(creep, spawn);
    }
  }

  /**
   * Schedules a Builder to be spawned
   * @param spawn - SpawnStructure
   * @param energyCapacity - Energy capacity in Room
   * @returns Spawn status code
   */
  private static createBuilder(
    spawn: StructureSpawn,
    energyCapacity: number
  ): number {
    console.log("Trying to create builder...");
    const name = `Builder${Game.time}`;
    const parts =
      energyCapacity >= 550
        ? [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]
        : [WORK, CARRY, MOVE];

    const res = spawn.spawnCreep(parts, name, {
      memory: { role: this.roleBuilder }
    });

    if (res === OK) {
      console.log("Spawning new builder: " + name);
    }

    return res;
  }

  /**
   * Schedules a Repairman to be spawned
   * @remarks TODO: Create a RepairManager
   * @param spawn - Spawn structure
   */
  private static createRepairman(spawn: StructureSpawn): void {
    const name = `Repairman${Game.time}`;
    console.log("Spawning new repairman: " + name);
    spawn.spawnCreep([WORK, CARRY, MOVE], name, {
      memory: { role: this.roleRepairman }
    });
  }

  /**
   * Queues a build to construct multiple road ways
   * @param paths - 2D list representing multiple road ways
   * @returns Memory object for the scheduled build
   */
  private buildMultipleRoads(paths: PathStep[][]): BuildMemory {
    const steps = paths
      .reduce((acc, val) => acc.concat(val), [])
      .map(step => new RoomPosition(step.x, step.y, this.room.name))
      .filter(rp => rp.lookFor(LOOK_STRUCTURES).length === 0);

    const memory = Build.createMemoryInstance("road", this.room.name, steps);
    this.buildQueue.enqueue(memory);

    // Schedule job's construction sites
    steps.forEach(step => {
      this.room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
    });

    return memory;
  }

  /**
   * Queues a build to construct structures of the given type at the given
   * room positions.
   * @param type - Type of structure to be built
   * @param positions - Coordinates of construction sites
   * @returns Memory object for building plans
   */
  private buildTypeAtPositions(
    type: BuildableStructureConstant,
    positions: RoomPosition[]
  ): BuildMemory {
    const memory = Build.createMemoryInstance(type, this.room.name, positions);
    this.buildQueue.enqueue(memory);

    // Schedule construction sites
    positions.forEach(pos => {
      this.room.createConstructionSite(pos.x, pos.y, type);
    });

    return memory;
  }

  /**
   * Queues a build to construct a road from point a to point b
   * @param from - Start position
   * @param to - End position
   * @param opts - Path options
   * @returns Memory object for the scheduled build
   */
  private buildRoadFromTo(
    from: RoomPosition,
    to: RoomPosition,
    opts?: FindPathOpts
  ): BuildMemory {
    // Find the best path from the origin to the destination
    const steps = this.room
      .findPath(from, to, opts)
      .map(s => new RoomPosition(s.x, s.y, this.room.name))
      .filter(rp => rp.lookFor(LOOK_STRUCTURES).length === 0);

    const memory = Build.createMemoryInstance(
      STRUCTURE_ROAD,
      this.room.name,
      steps
    );
    this.buildQueue.enqueue(memory);

    // Schedule job's construction sites
    steps.forEach(step => {
      this.room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
    });

    return memory;
  }

  /**
   * Queues a build to construct a road for waiting in line for sources
   * @param spawn - Spawn structure
   */
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
        const job = this.buildMultipleRoads(paths);

        // Link new job to the room's state
        jobState.jobId = job.id;
        jobState.inprogress = true;
      }
    } else {
      if (!jobState.jobId)
        throw new Error("Job State Error: Job in progress without id.");

      // Job is in progress. Find job to see if it's done
      if (this.currentBuild && this.currentBuild.id === jobState.jobId) {
        // If complete, toggle state flags and wipe ref to job since it will
        // be wiped from the schedule.
        if (this.currentBuild.complete) {
          jobState.inprogress = false;
          jobState.complete = true;
          delete jobState.jobId;
        }
      } else {
        // This build is not the current build. Let's make sure it's in the
        // queue, since our state is in progress.
        if (!this.buildQueue.containsWithId(jobState.jobId)) {
          throw new Error("Source queue build state configuration error");
        }
      }
    }
  }

  private spawnAdjacentWalkways(spawn: StructureSpawn): void {
    const jobState = this.roomState.spawnAdjacentWalkways;
    if (!jobState)
      throw new Error("Job State Not Configured: Spawn Adjacent Walkways.");
    if (jobState.complete) return;

    // Road hasn't been planned
    if (!jobState.inprogress) {
      const T = 3;
      const sx = spawn.pos.x;
      const sy = spawn.pos.y;
      const rname = spawn.room.name;

      const positions: RoomPosition[] = [];

      // Positions on X-axis
      for (let dx = 1; dx <= T; dx++) {
        positions.push(new RoomPosition(sx - dx, sy, rname));
        positions.push(new RoomPosition(sx + dx, sy, rname));
      }
      // Positions on Y-axis
      for (let dy = 1; dy <= T; dy++) {
        positions.push(new RoomPosition(sx, sy - dy, rname));
        positions.push(new RoomPosition(sx, sy + dy, rname));
      }
      // Positions on diagonals
      for (let dx = 1, dy = 1; dx <= T && dy <= T; dx++, dy++) {
        positions.push(new RoomPosition(sx + dx, sy - dy, rname));
        positions.push(new RoomPosition(sx + dx, sy + dy, rname));
        positions.push(new RoomPosition(sx - dx, sy + dy, rname));
        positions.push(new RoomPosition(sx - dx, sy - dy, rname));
      }

      // We only want positions without structures and are not walls
      const terrain = this.room.getTerrain();
      const viable = positions.filter(
        p =>
          p.lookFor(LOOK_STRUCTURES).length === 0 &&
          terrain.get(p.x, p.y) !== TERRAIN_MASK_WALL
      );

      // Queue build
      const buildMem = this.buildTypeAtPositions(STRUCTURE_ROAD, viable);

      // Link new build to room state
      jobState.jobId = buildMem.id;
      jobState.inprogress = true;
    } else {
      if (!jobState.jobId)
        throw new Error("Job State Error: Job in progress without id.");

      // Job is in progress. Find job to see if it's done.
      if (this.currentBuild) {
        // Is this job currently being worked?
        if (this.currentBuild.id === jobState.jobId) {
          // If complete, toggle state flags and wipe ref to job since it will
          // be wiped from the schedule.
          if (this.currentBuild.complete) {
            jobState.inprogress = false;
            jobState.complete = true;
            delete jobState.jobId;
          }
        }
      } else {
        // If there is no current build scheduled and we've reached this point,
        // something may have gone wrong. Check if this job is in the queue.
        if (!this.buildQueue.containsWithId(jobState.jobId)) {
          throw new Error("Spawn adjacent roads build state config error");
        }
      }
    }
  }

  /**
   * Queues a build to construct roads from the spawn to energy sources
   * @param spawn - Spawn structure
   */
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
      const buildMem = this.buildMultipleRoads(paths);

      // Link new job to the room's state
      jobState.jobId = buildMem.id;
      jobState.inprogress = true;
    } else {
      if (!jobState.jobId)
        throw new Error("Job State Error: Job in progress without id.");

      // Job is in progress. Find job to see if it's done
      if (this.currentBuild && this.currentBuild.id === jobState.jobId) {
        // If complete, toggle state flags and wipe ref to job since it will
        // be wiped from the schedule.
        if (this.currentBuild.complete) {
          jobState.inprogress = false;
          jobState.complete = true;
          delete jobState.jobId;
        }
      } else {
        // This build is not the current build. Let's make sure it's in the
        // queue, since our state is in progress.
        if (!this.buildQueue.containsWithId(jobState.jobId)) {
          throw new Error("Spawn to source build state configuration error");
        }
      }
    }
  }

  /**
   * Queues a build to construct a road from the spawn to the room's controller
   * @param spawn - Spawn structure
   */
  private buildRoadSpawnToCtrl(spawn: StructureSpawn): void {
    const jobState = this.roomState.roadFromSpawnToCtrl;
    if (!jobState)
      throw new Error("Job State Not Configured: Road from spawn to ctrl.");
    if (jobState.complete) return;

    if (!jobState.inprogress) {
      if (!this.room.controller) throw new Error("Room has no controller");

      // Add a new job to this room's schedule
      const ctrlPos = this.room.controller.pos;
      const job = this.buildRoadFromTo(spawn.pos, ctrlPos, { range: 1 });

      // Link new job to the room's state
      jobState.jobId = job.id;
      jobState.inprogress = true;
    } else {
      if (!jobState.jobId)
        throw new Error("Job State Error: Job in progress without id.");

      // Job is in progress. Find job to see if it's done
      if (this.currentBuild && this.currentBuild.id === jobState.jobId) {
        // If complete, toggle state flags and wipe ref to job since it will
        // be wiped from the schedule.
        if (this.currentBuild.complete) {
          jobState.inprogress = false;
          jobState.complete = true;
          delete jobState.jobId;
        }
      } else {
        // This build is not the current build. Let's make sure it's in the
        // queue, since our state is in progress.
        if (!this.buildQueue.containsWithId(jobState.jobId)) {
          throw new Error("Spawn to ctrl build state configuration error");
        }
      }
    }
  }

  private buildOutpostRoads(spawn: StructureSpawn): void {
    const outpostFlags = this.room.find(FIND_FLAGS, {
      filter: flag => {
        return flag.name.startsWith("outpost_");
      }
    });

    for (const outpost of outpostFlags) {
      if (outpost.name in this.roomState.outpostRoads === false) {
        this.roomState.outpostRoads[outpost.name] = {
          inprogress: false,
          complete: false
        };
      }

      const state = this.roomState.outpostRoads[outpost.name];
      if (state.complete) continue;

      // Path has not yet been planned
      if (!state.inprogress) {
        const build = this.buildRoadFromTo(spawn.pos, outpost.pos, {
          ignoreCreeps: true
        });

        // Link new build to the room's state
        state.jobId = build.id;
        state.inprogress = true;
      } else {
        if (!state.jobId)
          throw new Error("Build State Error: Build in progress without id.");

        // Build is in progress. Find build to see if it's done
        if (this.currentBuild && this.currentBuild.id === state.jobId) {
          // If complete, toggle state flags and wipe ref to job since it will
          // be wiped from the schedule.
          if (this.currentBuild.complete) {
            state.inprogress = false;
            state.complete = true;
            delete state.jobId;
          }
        } else {
          // This build is not the current build. Let's make sure it's in the
          // queue, since our state is in progress.
          if (!this.buildQueue.containsWithId(state.jobId)) {
            // throw new Error("Outpost road build state configuration error");
          }
        }
      }
    }
  }
}
