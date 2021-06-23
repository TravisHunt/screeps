import "prototypes/AllImports";
import { ErrorMapper } from "utils/ErrorMapper";
import RoomManager from "managers/room/RoomManager";
import SpawnService from "services/SpawnService";
import StorageService from "services/StorageService";
import MaintenanceService from "services/MaintenanceService";
import StatisticsService from "services/StatisticsServices";
import { USERNAME } from "screeps.constants";
import SourceService2 from "services/SourceService2";

const currentVersion = "0.0.2";

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  let shouldMigrate = false;
  if (!Memory.version) Memory.version = "0.0.1";
  if (Memory.version !== currentVersion) {
    shouldMigrate = true;
    Memory.version = currentVersion;
  }

  // TEMP MARKET ENERGY SELLS
  // TODO: Refresh on the daily
  const maxSell = 5000;
  if (
    Game.rooms.E27N33.terminal &&
    Game.rooms.E27N33.terminal.cooldown === 0 &&
    Game.rooms.E27N33.terminal.store.energy >= maxSell * 2
  ) {
    const history = Game.market.getHistory(RESOURCE_ENERGY).reverse()[0];
    const orders: Order[] = Game.market
      .getAllOrders(
        o =>
          o.type === ORDER_BUY &&
          o.resourceType === RESOURCE_ENERGY &&
          o.price >= history.avgPrice
      )
      .sort((a, b) => a.price - b.price)
      .reverse();

    console.log(
      `${orders.length} energy buy orders with a price greater than or equal to ${history.avgPrice}`
    );
    for (const o of orders) {
      const amount = Math.min(o.amount, maxSell);
      const tranCost = Game.market.calcTransactionCost(
        amount,
        "E27N33",
        o.roomName || "E27N33"
      );
      const totalCost = amount + tranCost;
      const profit = amount * o.price;

      // Can I fill this order?
      if (Game.rooms.E27N33.terminal.store.energy >= totalCost) {
        const res = Game.market.deal(o.id, amount, "E27N33");
        if (res === OK) {
          console.log(
            `Filled order: Amount: ${amount}, Price Per: ${o.price}, Total Cost: ${totalCost}, Profit: ${profit}`
          );
        } else {
          console.log(`Order failed: ${res}`);
        }
        break;
      }
    }
  }

  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }

  // Init memory tables for various processes
  if (!Memory.logs) Memory.logs = [];
  if (!Memory.rooms) Memory.rooms = {};
  if (!Memory.maintenance) Memory.maintenance = {};

  const spawnService = SpawnService.getInstance(true);
  const storageService = StorageService.getInstance(true);
  const sourceService = SourceService2.getInstance(true);

  const roomManagers: RoomManager[] = [];

  for (const name in Game.rooms) {
    // If this is a newly visible room, we check to see if we want to manage.
    if (name in Memory.rooms === false) {
      const room = Game.rooms[name];
      // To track, we need to be the owner of the controller
      if (room.controller && room.controller.owner) {
        if (room.controller.owner.username === USERNAME) {
          roomManagers.push(new RoomManager(name, { migrate: shouldMigrate }));
        }
      }
    } else {
      roomManagers.push(new RoomManager(name, { migrate: shouldMigrate }));
    }
  }

  roomManagers.forEach(rm => rm.run());

  // Run maintenance jobs and process maintenance requests
  const maintenanceService = MaintenanceService.getInstance();
  maintenanceService.run();

  spawnService.run();
  storageService.run();
  sourceService.run();

  const statsService = StatisticsService.getInstance();
  statsService.run();
});
