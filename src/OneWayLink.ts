/**
 * A pair of Link structures that act as a one-way channel for energy
 * transfer. Energy from the first link is sent to the second. Energy
 * is NOT sent from the second to the first.
 */
export default class OneWayLink {
  public sender: StructureLink;
  public receiver: StructureLink;

  /**
   * A pair of Link structures that act as a one-way channel for energy
   * transfer. Energy from the first link is sent to the second. Energy
   * is NOT sent from the second to the first.
   * @param sender - Link that sends energy to the other
   * @param receiver - Link that receives energy from the other
   */
  public constructor(sender: StructureLink, receiver: StructureLink) {
    this.sender = sender;
    this.receiver = receiver;
  }

  /**
   * Available energy capacity in sender link.
   */
  public get senderFreeCapacity(): number {
    return this.sender.store.getFreeCapacity(RESOURCE_ENERGY);
  }

  /**
   * Available energy capacity in receiver link.
   */
  public get receiverFreeCapacity(): number {
    return this.receiver.store.getFreeCapacity(RESOURCE_ENERGY);
  }

  /**
   * Indicates whether or not the sender link is empty.
   */
  public get senderEmpty(): boolean {
    return this.receiver.store.getUsedCapacity(RESOURCE_ENERGY) === 0;
  }

  /**
   * Indicates whether or not the receiver link is empty.
   */
  public get receiverEmpty(): boolean {
    return this.receiver.store.getUsedCapacity(RESOURCE_ENERGY) === 0;
  }

  public get readyToSend(): boolean {
    return (
      this.sender.cooldown === 0 &&
      this.sender.store.getFreeCapacity(RESOURCE_ENERGY) === 0
    );
  }

  public static getPairFrom(
    memory: LinkPairMemory
  ): [StructureLink | null, StructureLink | null] {
    let linkA: StructureLink | null = null;
    let linkB: StructureLink | null = null;

    if (memory.a) linkA = Game.getObjectById(memory.a);
    if (memory.b) linkB = Game.getObjectById(memory.b);

    return [linkA, linkB];
  }

  public contains(link: StructureLink): boolean {
    return link.id === this.sender.id || link.id === this.receiver.id;
  }

  /**
   * Initiates a transfer of energy from the Creep to the sender link.
   * @param creep - Creep transferring energy to sender
   * @param opts - Options to shape transfer request
   * @returns Transfer status code
   */
  public transfer(creep: Creep, opts?: DepositOpts): ScreepsReturnCode {
    const amt: number | undefined = opts && opts.amount;
    return creep.transfer(this.sender, RESOURCE_ENERGY, amt);
  }

  /**
   * Initiates a transfer of energy from the sender link to the receiver link.
   * @param amount - Energy to send
   * @returns Send status code
   */
  public send(amount?: number): ScreepsReturnCode {
    if (this.sender.cooldown > 0) return ERR_TIRED;
    if (
      this.sender.store[RESOURCE_ENERGY] <
      this.sender.store.getCapacity(RESOURCE_ENERGY)
    ) {
      return ERR_NOT_ENOUGH_RESOURCES;
    }

    return this.sender.transferEnergy(this.receiver, amount);
  }
}
