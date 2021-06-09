import XPARTS from "./XPARTS";
import * as roles from "roles";

export default function BestParts(
  role: roles.AnyCreepRole,
  spawn: StructureSpawn
): BodyPartConstant[] {
  let parts: BodyPartConstant[] = [];

  if (role === roles.RoleMaintainer) {
    parts = BestPartsMaintainer(spawn);
  } else {
    throw new Error(`BestParts: Role ${role} not yet implemented!`);
  }

  return parts;
}

export function BestPartsMaintainer(spawn: StructureSpawn): BodyPartConstant[] {
  const totalEnergy = spawn.room.energyAvailable;
  const xpartsArgs: [BodyPartConstant, number][] = [];

  if (totalEnergy < SPAWN_ENERGY_CAPACITY) return [];

  // We want two work parts in any situation
  xpartsArgs.push([WORK, 2]);

  if (totalEnergy >= 800) {
    xpartsArgs.push([CARRY, 6], [MOVE, 6]);
  } else {
    xpartsArgs.push([CARRY, 1], [MOVE, 1]);
  }

  return XPARTS(...xpartsArgs);
}
