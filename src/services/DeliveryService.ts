import { RENEW_THRESHOLD } from "screeps.constants";
import Queue from "utils/Queue";
import XPARTS from "utils/XPARTS";
import ResourceService from "./ResourceService";

export default class DeliveryService {
  public static readonly roleCourier = "courier";
  private room: Room;
  private memory: RoomMemory;
  private courierMax: number;
  private deliveryQueue: Queue<ResourceRequestFromBucket>;
  private couriers: Creep[];
  private resourceService: ResourceService;

  public constructor(
    room: Room,
    memory: RoomMemory,
    couriers: Creep[],
    courierMax: number,
    queue: Queue<ResourceRequestFromBucket>,
    resourceService: ResourceService
  ) {
    this.room = room;
    this.memory = memory;
    this.deliveryQueue = queue;
    this.couriers = couriers;
    this.courierMax = courierMax;
    this.resourceService = resourceService;
  }

  public run(): void {
    // Assign queued contracts if we have any
    if (this.deliveryQueue.length) {
      while (this.deliveryQueue.length > 0) {
        const courier = this.getAvailableCourier();

        if (!courier) {
          // Can we spawn a new courier to meet demand?
          if (this.couriers.length < this.courierMax) {
            if (this.trySpawnCourier() === OK) {
              console.log("Spawning Courier...");
            }
          }
          // Break since we can't fill any more orders
          break;
        } else {
          const contract = this.deliveryQueue.dequeue();
          if (contract) {
            courier.memory.contract = contract as ResourceDeliveryContract;
            // TODO: initialize delivered value in constructor
            courier.memory.contract.delivered = 0;
          }
        }
      }
    }

    // TODO: I don't think this is actually necessary. Investigate if
    // the queue instance properly saves to memory.
    // Save updated delivery queue to memory
    this.memory.deliveryQueue = this.deliveryQueue.queue;

    // Couriers without contracts return home and unload
    this.couriers
      .filter(c => !c.spawning && c.memory.contract === undefined)
      .forEach(c => {
        if (this.room.storage) {
          for (const type in c.store) {
            const res = c.transfer(this.room.storage, type as ResourceConstant);
            if (res === ERR_NOT_IN_RANGE) {
              c.moveTo(this.room.storage);
              break;
            }
          }
        }
      });

    // Direct couriers with contracts
    this.couriers
      .filter(c => !c.spawning && c.memory.contract !== undefined)
      .forEach(c => {
        if (!c.memory.contract) return; // stupid type safety
        const contract = c.memory.contract;

        if (contract.delivered >= contract.amount) {
          // Contract complete. Delete and return.
          delete c.memory.contract;
          return;
        }

        if (!c.memory.harvesting && c.store.getFreeCapacity(contract.type)) {
          c.memory.harvesting = true;
        }
        if (c.memory.harvesting && c.store.getFreeCapacity() === 0) {
          // Should I renew?
          const shouldRenew = c.ticksToLive && c.ticksToLive < RENEW_THRESHOLD;
          const cSize = c.body.length;
          const cCost = c.body
            .map(part => BODYPART_COST[part.type])
            .reduce((total, val) => total + val);
          const renewCost = Math.ceil(cCost / 2.5 / cSize);
          console.log(
            `Should renew: ${
              shouldRenew ? "YES" : "NO"
            }, Renew cost: ${renewCost}`
          );
          if (shouldRenew) {
            const spawn = c.pos.findClosestByRange(FIND_MY_SPAWNS);
            if (spawn && spawn.store[RESOURCE_ENERGY] > renewCost) {
              if (spawn.renewCreep(c) === ERR_NOT_IN_RANGE) {
                c.moveTo(spawn);
                return;
              }
            }
          }

          c.memory.harvesting = false;
        }

        if (c.memory.harvesting) {
          const withdrawAmt = Math.min(
            contract.amount,
            c.store.getFreeCapacity(contract.type)
          );

          this.resourceService.submitResourceRequest(c, contract.type, {
            amount: withdrawAmt
          });
        } else {
          const bucket = Game.getObjectById(contract.bucketId);

          if (!bucket) {
            // Assume the bucket no longer exists. Close contract.
            delete c.memory.contract;
            return;
          }

          const transferAmt = Math.min(
            contract.amount - contract.delivered,
            c.store.getUsedCapacity(contract.type)
          );
          const transferRes = c.transfer(bucket, contract.type, transferAmt);

          if (transferRes === OK) {
            contract.delivered += transferAmt;
            c.say(`${contract.delivered}/${contract.amount}`);
            if (contract.delivered >= contract.amount) {
              // Contract complete. Close contract.
              delete c.memory.contract;
            }
          } else if (transferRes === ERR_FULL) {
            // Contract complete. Close contract.
            delete c.memory.contract;
          } else if (transferRes === ERR_NOT_IN_RANGE) {
            c.moveTo(bucket.pos);
          }
        }
      });
  }

  public acceptResourceRequests(requests: ResourceRequestFromBucket[]): void {
    for (const req of requests) {
      // See if a request to fill this bucket with this resource has already
      // been made before queueing the request.
      const match = this.deliveryQueue.queue.find(
        x => x.bucketId === req.bucketId && x.type === req.type
      );
      const working = this.couriers.find(
        c =>
          c.memory.contract &&
          c.memory.contract.bucketId === req.bucketId &&
          c.memory.contract.type === req.type
      );
      if (!match && !working) {
        console.log(`Request queued: ${JSON.stringify(req)}`);
        this.deliveryQueue.enqueue(req);
      }
    }
  }

  private getAvailableCourier(): Creep | undefined {
    return this.couriers.find(c => !c.spawning && !c.memory.contract);
  }

  private trySpawnCourier(): ScreepsReturnCode {
    // Find a spawn in this room that isn't currently spawning
    const spawns = this.room.find(FIND_MY_SPAWNS, {
      filter: s => !s.spawning
    });

    if (!spawns.length) return ERR_BUSY;

    const parts = XPARTS([CARRY, 4], [MOVE, 4]);
    const name = `Courier${Game.time}`;
    const res = spawns[0].spawnCreep(parts, name, {
      memory: {
        role: DeliveryService.roleCourier,
        origin: this.room.name
      }
    });

    if (res === OK) this.memory.courierNames.push(name);

    return res;
  }
}
