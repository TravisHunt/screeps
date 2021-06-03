/**
 * Type guards library. Each type guard differentiates ambigous inputs by
 * recognizing 1 to n unique properties of the given object.
 */

/**
 * Extends RoomObject with the id property.
 */
export interface Identifiable extends RoomObject {
  id: Id<this>;
}

/**
 * Extends Structure with energy and energyCapacity properties.
 */
export interface EnergyStructure extends Structure {
  energy: number;
  energyCapacity: number;
}

/**
 * Extends Structure with store and storeCapacity properties.
 */
export interface StoreStructure extends Structure {
  store: StoreDefinition;
  storeCapacity: number;
}

/**
 * Type guard that determines if the given room object is of type Identifiable,
 * which is an object of type RoomObject with an id property.
 * @param obj - An instance of RoomObject.
 * @returns True if the instance is of type Identifiable, otherwise False.
 */
export function isIdentifiable(obj: RoomObject): obj is Identifiable {
  return (obj as Identifiable).id !== undefined;
}

/**
 * Type guard that determines if the given room object is of type
 * EnergyStructure, which is an object of type Structure with energy and
 * energyCapacity properties.
 * @param obj - An instance of RoomObject.
 * @returns True if the instance is of type EnergyStructure, otherwise False.
 */
export function isEnergyStructure(obj: RoomObject): obj is EnergyStructure {
  return (
    (obj as EnergyStructure).energy !== undefined &&
    (obj as EnergyStructure).energyCapacity !== undefined
  );
}

/**
 * Type guard that determines if the given room object is of type
 * StoreStructure, which is an object of type Structure with store and
 * storeCapacity properties.
 * @param obj - An instance of RoomObject.
 * @returns True if the instance is of type StoreStructure, otherwise False.
 */
export function isStoreStructure(obj: RoomObject): obj is StoreStructure {
  return (
    (obj as StoreStructure).store !== undefined &&
    (obj as StoreStructure).storeCapacity !== undefined
  );
}

/**
 * Type guard that determines if the given room object is of type Structure.
 * @param obj - An instance of RoomObject.
 * @returns True if the instance is of type Structure, otherwise False.
 */
export function isStructure(obj: RoomObject): obj is Structure {
  return (obj as Structure).structureType !== undefined;
}

/**
 * Type guard that determines if the given room object is of type Tombstone.
 * @param obj - An instance of RoomObject.
 * @returns True if the instance is of type Tombstone, otherwise False.
 */
export function isTombstone(obj: RoomObject): obj is Tombstone {
  return (obj as Tombstone).deathTime !== undefined;
}

/**
 * Type guard that determines if the given room object is of type Resource.
 * @param obj - An instance of RoomObject.
 * @returns True if the instance is of type Resource, otherwise False.
 */
export function isResource(obj: RoomObject): obj is Resource {
  return (obj as Resource).amount !== undefined;
}

/**
 * Type guard that determines if the given room object is of type Creep.
 * @param obj - An instance of RoomObject.
 * @returns True if the instance is of type Creep, otherwise False.
 */
export function isCreep(obj: RoomObject): obj is Creep {
  return (obj as Creep).fatigue !== undefined;
}

/**
 * Type guard that determines if the given room object is of type PowerCreep.
 * @param obj - An instance of RoomObject.
 * @returns True if the instance is of type PowerCreep, otherwise False.
 */
export function isPowerCreep(obj: RoomObject): obj is PowerCreep {
  return (obj as PowerCreep).powers !== undefined;
}

/**
 * Type guard that determines if the given room object is of type OwnedStructure.
 * @param obj - An instance of RoomObject.
 * @returns True if the instance is of type OwnedStructure, otherwise False.
 */
export function isOwnedStructure(obj: Structure): obj is OwnedStructure {
  return (obj as OwnedStructure).owner !== undefined;
}

/**
 * Type guard that determines if the given room object is of type Source.
 * @param obj - An instance of RoomObject.
 * @returns True if the instance is of type Source, otherwise False.
 */
export function isSource(obj: Source | Mineral): obj is Source {
  return (obj as Source).energy !== undefined;
}
