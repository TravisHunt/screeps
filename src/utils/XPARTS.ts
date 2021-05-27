export default function XPARTS(
  ...parts: [BodyPartConstant, number][]
): BodyPartConstant[] {
  const partsList: BodyPartConstant[] = [];

  for (const [type, num] of parts) {
    for (let i = 0; i < num; i++) {
      partsList.push(type);
    }
  }

  return partsList;
}
