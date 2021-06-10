import { Dictionary } from "lodash";
import { QUADRANT } from "utils/enums";
import {
  findTypeHasPosition,
  findTypeIsPosition,
  hasPos
} from "utils/typeGuards";

/**
 * Room prototypes - commonly used properties
 */
declare global {
  interface Room {
    owner(): string | undefined;
    my(): boolean;

    _creeps: Creep[];
    creeps(): Creep[];

    _hostiles: Creep[];
    hostiles(): Creep[];

    _invaders: Creep[];
    invaders(): Creep[];

    _drops: Dictionary<Resource<ResourceConstant>[]>;
    drops(): Dictionary<Resource<ResourceConstant>[]>;
    droppedEnergy(): Resource<RESOURCE_ENERGY>[];
    droppedPower(): Resource<RESOURCE_POWER>[];

    findWithinQuadrant<F extends FindConstant>(
      find: F,
      quadrant: number,
      opts?: FilterOptions<F>
    ): FindTypes[F][];
  }
}

Room.prototype.findWithinQuadrant = function (find, quadrant, opts) {
  // If a filter was specified, save it to be run after area narrowing.
  const providedFilter:
    | FilterFunction<typeof find>
    | FilterObject
    | string
    | undefined = opts && opts.filter ? opts.filter : undefined;

  const options: FilterOptions<typeof find> = {
    filter: item => {
      let pos: RoomPosition;

      if (findTypeHasPosition(item)) {
        // Has RoomPosition property
        pos = item.pos;
      } else if (findTypeIsPosition(item)) {
        // Is RoomPosition instance
        pos = item;
      } else {
        // This shouldn't happen
        console.log(`Room.findWithinQuadrant: item has no position (${find})`);
        return false;
      }

      // Is position in the specified quadrant?
      if (pos.inQuadrant(quadrant) === false) return false;

      // The item is in the quadrant. Run user filter if provided.
      return providedFilter
        ? _.filter([item], providedFilter).length > 0
        : true;
    }
  };

  return this.find(find, options);
};

// #region common room properties
Room.prototype.owner = function () {
  return this.controller && this.controller.owner
    ? this.controller.owner.username
    : undefined;
};

Room.prototype.my = function () {
  return this.controller ? this.controller.my : false;
};
// #endregion

// #region creeps
Room.prototype.creeps = function () {
  if (!this._creeps) {
    this._creeps = this.find(FIND_MY_CREEPS);
  }
  return this._creeps;
};
// #endregion

// #region hostile creeps
Room.prototype.hostiles = function () {
  if (!this._hostiles) {
    this._hostiles = this.find(FIND_HOSTILE_CREEPS);
  }
  return this._hostiles;
};

Room.prototype.invaders = function () {
  if (!this._invaders) {
    this._invaders = _.filter(
      this.hostiles(),
      (creep: Creep) => creep.owner.username === "Invader"
    );
  }
  return this._invaders;
};
// #endregion

// #region structures
Room.prototype.drops = function () {
  if (!this._drops) {
    this._drops = _.groupBy(
      this.find(FIND_DROPPED_RESOURCES),
      (r: Resource) => r.resourceType
    );
  }
  return this._drops;
};

Room.prototype.droppedEnergy = function () {
  return (this.drops()[RESOURCE_ENERGY] || []) as Resource<RESOURCE_ENERGY>[];
};

Room.prototype.droppedPower = function () {
  return (this.drops()[RESOURCE_POWER] || []) as Resource<RESOURCE_POWER>[];
};
// #endregion

export {};
