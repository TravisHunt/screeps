import { Dictionary } from "lodash";
import { findTypeHasPosition, findTypeIsPosition } from "utils/typeGuards";

/**
 * Room prototypes - commonly used properties
 */
declare global {
  interface Room {
    /**
     * Gets the username of the owner of this room's controller, if one exists.
     */
    owner(): string | undefined;

    /**
     * Returns true if this room's controller is owned by me.
     */
    my(): boolean;

    /**
     * Get my creeps in this room.
     */
    creeps(): Creep[];
    _creeps: Creep[];

    /**
     * Get hostile creeps in this room.
     */
    hostiles(): Creep[];
    _hostiles: Creep[];

    /**
     * Get invaders in this room. Invaders are hostile creeps owned by the
     * Invader AI.
     */
    invaders(): Creep[];
    _invaders: Creep[];

    /**
     * Finds dropped resources in this room.
     */
    drops(): Dictionary<Resource<ResourceConstant>[]>;
    _drops: Dictionary<Resource<ResourceConstant>[]>;

    /**
     * Finds dropped energy in this room.
     */
    droppedEnergy(): Resource<RESOURCE_ENERGY>[];

    /**
     * Finds dropped power in this room.
     */
    droppedPower(): Resource<RESOURCE_POWER>[];

    /**
     * Find objects in this room within the provided quadrant.
     * @param find - FIND_* constant
     * @param quadrant - One of four quadrants of this room's map
     * @param opts - Filter options
     */
    findWithinQuadrant<F extends FindConstant>(
      find: F,
      quadrant: number,
      opts?: FilterOptions<F>
    ): FindTypes[F][];

    /**
     * Find my structures with the given structure type.
     * @param type - STRUCTURE_* constant
     */
    findMyStructures<K extends StructureConstant>(type: K): AnyOwnedStructure[];
  }
}

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

Room.prototype.findMyStructures = function (type) {
  return this.find(FIND_MY_STRUCTURES, {
    filter: { structureType: type }
  });
};

export {};
