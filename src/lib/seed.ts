import type {
  ActivityEntry,
  Customer,
  DispatchRecord,
  InventoryRecord,
  Order,
  OrderItem,
  OrderStatus,
  PackingTask,
  PickingTask,
  PickingTaskItem,
  Priority,
  Product,
  QualityCheck,
  WarehouseException,
  WarehouseState,
  Worker,
} from "./types";
import { availableQty } from "./types";

/** Deterministic PRNG so every demo session looks identical and stable. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const PRODUCT_DEFS: Array<[string, string, number]> = [
  ["Titan 4K Action Camera", "Electronics", 289.0],
  ["Aero Noise-Cancel Headset", "Electronics", 179.5],
  ["Volt 20K Power Bank", "Electronics", 59.99],
  ["Nimbus Mesh Router AX", "Electronics", 149.0],
  ["Pulse Smart Watch S3", "Electronics", 219.0],
  ["Lumen LED Desk Lamp", "Home", 44.25],
  ["Terra Ceramic Cookware Set", "Home", 132.0],
  ["Halo Air Purifier Mini", "Home", 98.75],
  ["Drift Weighted Blanket", "Home", 71.4],
  ["Onyx Cast Iron Skillet", "Home", 38.9],
  ["Forge Cordless Drill 18V", "Tools", 164.0],
  ["Forge Impact Driver Kit", "Tools", 212.5],
  ["Gridline Laser Level", "Tools", 87.3],
  ["Ironclad Socket Set 46pc", "Tools", 63.0],
  ["Torque Wrench Pro", "Tools", 118.6],
  ["Summit Trail Backpack 40L", "Outdoor", 129.0],
  ["Summit 3-Season Tent", "Outdoor", 249.9],
  ["Glacier Insulated Bottle", "Outdoor", 32.5],
  ["Trailhead Hiking Poles", "Outdoor", 54.0],
  ["Ember Portable Grill", "Outdoor", 143.2],
  ["Kinetic Resistance Band Set", "Fitness", 27.99],
  ["Kinetic Adjustable Dumbbell", "Fitness", 189.0],
  ["Stride Yoga Mat Pro", "Fitness", 48.5],
  ["Vertex Jump Rope", "Fitness", 19.99],
  ["Core Balance Trainer", "Fitness", 66.0],
  ["Atlas Office Chair", "Furniture", 329.0],
  ["Atlas Standing Desk 48\"", "Furniture", 419.0],
  ["Nook Storage Ottoman", "Furniture", 88.0],
  ["Loft Bookshelf 5-Tier", "Furniture", 156.0],
  ["Meridian Monitor Arm", "Furniture", 74.5],
];

const ZONES = ["Zone A", "Zone B", "Zone C", "Zone D"];

const CUSTOMER_DEFS: Array<[string, Customer["type"]]> = [
  ["Northwind Retail Group", "Wholesale"],
  ["Bluepeak Electronics", "Enterprise"],
  ["Harbor & Co. Outfitters", "Retail"],
  ["Cedar Lane Marketplace", "Marketplace"],
  ["Ironbridge Supply", "Wholesale"],
  ["Vantage Fitness Studios", "Enterprise"],
  ["Maple Street Home", "Retail"],
  ["Quantum Works Ltd.", "Enterprise"],
  ["Riverside Trading", "Marketplace"],
  ["Summit Gear Depot", "Retail"],
];

const WORKER_DEFS: Array<[string, Worker["role"], string]> = [
  ["Elena Rojas", "Picker", "Zone A"],
  ["Marcus Bell", "Picker", "Zone B"],
  ["Priya Nair", "Picker", "Zone C"],
  ["Tomás Ferreira", "Picker", "Zone D"],
  ["Aisha Khan", "Packer", "Packing Hall"],
  ["Dmitri Volkov", "Packer", "Packing Hall"],
  ["Grace Lin", "QC Inspector", "QC Bay"],
  ["Samuel Okafor", "QC Inspector", "QC Bay"],
  ["Nora Haddad", "Dispatch Lead", "Dock 1"],
  ["Liam Doyle", "Dispatch Lead", "Dock 2"],
];

const STAGE_PLAN: Array<[OrderStatus, Priority]> = [
  ["Created", "Urgent"],
  ["Created", "High"],
  ["Created", "Normal"],
  ["Created", "Low"],
  ["Created", "Normal"],
  ["Allocated", "Urgent"],
  ["Allocated", "Normal"],
  ["Allocated", "High"],
  ["Picking", "Urgent"],
  ["Picking", "High"],
  ["Picking", "Normal"],
  ["Packing", "High"],
  ["Packing", "Normal"],
  ["Quality Check", "Urgent"],
  ["Quality Check", "Normal"],
  ["Ready for Dispatch", "High"],
  ["Ready for Dispatch", "Normal"],
  ["Ready for Dispatch", "Urgent"],
  ["Dispatched", "Normal"],
  ["Dispatched", "High"],
  ["Dispatched", "Low"],
  ["Completed", "Normal"],
  ["Completed", "Urgent"],
];

const stageIndex: Record<OrderStatus, number> = {
  Created: 0,
  Allocated: 1,
  Picking: 2,
  Packing: 3,
  "Quality Check": 4,
  "Ready for Dispatch": 5,
  Dispatched: 6,
  Completed: 7,
};

const HOUR = 3600_000;

export function buildSeedState(now = Date.now()): WarehouseState {
  const rng = makeRng(20260815);
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

  const products: Product[] = PRODUCT_DEFS.map(([name, category, price], i) => ({
    id: `prd-${i + 1}`,
    sku: `${category.slice(0, 3).toUpperCase()}-${String(1000 + i * 7)}`,
    name,
    category,
    price,
    reorderThreshold: 10 + Math.floor(rng() * 15),
  }));

  const inventory: InventoryRecord[] = products.map((p, i) => {
    const roll = rng();
    let total: number;
    if (i % 11 === 3) total = 0;
    else if (i % 7 === 2) total = p.reorderThreshold + Math.floor(rng() * 4);
    else total = 60 + Math.floor(roll * 240);
    return {
      id: `inv-${i + 1}`,
      productId: p.id,
      zone: ZONES[i % ZONES.length]!,
      bin: `${ZONES[i % ZONES.length]!.slice(-1)}-${String(1 + (i % 9)).padStart(2, "0")}-${String(
        1 + (i % 5),
      ).padStart(2, "0")}`,
      totalQty: total,
      reservedQty: 0,
      damagedQty: i % 6 === 1 ? 2 + Math.floor(rng() * 6) : 0,
    };
  });

  const customers: Customer[] = CUSTOMER_DEFS.map(([name, type], i) => ({
    id: `cus-${i + 1}`,
    name,
    email: `ops@${name.toLowerCase().replace(/[^a-z]+/g, "")}.com`,
    phone: `+1 (415) 555-0${String(100 + i)}`,
    type,
  }));

  const workers: Worker[] = WORKER_DEFS.map(([name, role, zone], i) => ({
    id: `wrk-${i + 1}`,
    name,
    role,
    zone,
    available: i % 4 !== 3,
  }));

  const orders: Order[] = [];
  const orderItems: OrderItem[] = [];
  const pickingTasks: PickingTask[] = [];
  const packingTasks: PackingTask[] = [];
  const qualityChecks: QualityCheck[] = [];
  const dispatches: DispatchRecord[] = [];
  const exceptions: WarehouseException[] = [];
  const activity: ActivityEntry[] = [];

  let actSeq = 0;
  const log = (msAgo: number, actor: string, action: string, entity: string, description: string) => {
    activity.push({
      id: `act-${++actSeq}`,
      timestamp: iso(msAgo),
      actor,
      action,
      entity,
      description,
    });
  };
  let excSeq = 0;
  const addException = (
    msAgo: number,
    e: Omit<WarehouseException, "id" | "code" | "createdAt" | "updatedAt">,
  ) => {
    excSeq += 1;
    exceptions.push({
      ...e,
      id: `exc-${excSeq}`,
      code: `EXC-${String(1000 + excSeq)}`,
      createdAt: iso(msAgo),
      updatedAt: iso(msAgo),
    });
  };

  STAGE_PLAN.forEach(([stage, priority], idx) => {
    const orderId = `ord-${idx + 1}`;
    const customer = customers[idx % customers.length]!;
    const createdAgo = (STAGE_PLAN.length - idx) * 6 * HOUR + Math.floor(rng() * 4 * HOUR);
    const promisedAgo = createdAgo - (idx % 5 === 0 ? -2 * HOUR : 48 * HOUR);
    const itemCount = 1 + Math.floor(rng() * 3);
    const usedProducts = new Set<number>();
    let value = 0;
    const items: OrderItem[] = [];
    for (let k = 0; k < itemCount; k++) {
      let pi = Math.floor(rng() * products.length);
      while (usedProducts.has(pi)) pi = (pi + 1) % products.length;
      usedProducts.add(pi);
      const product = products[pi]!;
      const requested = 2 + Math.floor(rng() * 10);
      value += requested * product.price;
      items.push({
        id: `oit-${orderId}-${k + 1}`,
        orderId,
        productId: product.id,
        requestedQty: requested,
        allocatedQty: 0,
        pickedQty: 0,
        packedQty: 0,
      });
    }

    const order: Order = {
      id: orderId,
      orderNumber: `SO-${String(24800 + idx)}`,
      customerId: customer.id,
      orderDate: iso(createdAgo),
      promisedDispatchDate: iso(promisedAgo),
      priority,
      status: stage,
      totalValue: Math.round(value * 100) / 100,
    };
    orders.push(order);
    log(createdAgo, customer.name, "Order Created", order.orderNumber, `Order ${order.orderNumber} received (${priority} priority, ${items.length} line items).`);

    const s = stageIndex[stage];

    // Allocation
    if (s >= 1) {
      items.forEach((it) => {
        const inv = inventory.find((iv) => iv.productId === it.productId)!;
        const take = Math.min(it.requestedQty, availableQty(inv));
        it.allocatedQty = take;
        inv.reservedQty += take;
      });
      const partial = items.some((it) => it.allocatedQty < it.requestedQty);
      log(createdAgo - 1 * HOUR, "System", "Stock Allocated", order.orderNumber, `${partial ? "Partial" : "Full"} allocation completed for ${order.orderNumber}.`);
      if (partial) {
        const short = items.find((it) => it.allocatedQty < it.requestedQty)!;
        addException(createdAgo - 1 * HOUR, {
          orderId,
          productId: short.productId,
          type: "Stock Mismatch",
          severity: priority === "Urgent" ? "Critical" : "High",
          description: `Insufficient stock for ${products.find((p) => p.id === short.productId)!.name}: requested ${short.requestedQty}, allocated ${short.allocatedQty}.`,
          status: idx % 3 === 0 ? "Investigating" : "Open",
        });
      }
    }

    // Picking task
    if (s >= 2) {
      const picker = workers.filter((w) => w.role === "Picker")[idx % 4]!;
      const taskItems: PickingTaskItem[] = items.map((it, k) => {
        const inv = inventory.find((iv) => iv.productId === it.productId)!;
        return {
          id: `pti-${orderId}-${k + 1}`,
          taskId: `pck-${orderId}`,
          productId: it.productId,
          location: `${inv.zone} · ${inv.bin}`,
          requiredQty: it.allocatedQty,
          pickedQty: 0,
          status: "Pending",
        };
      });
      const task: PickingTask = {
        id: `pck-${orderId}`,
        taskCode: `PK-${String(4100 + idx)}`,
        orderId,
        workerId: picker.id,
        zone: picker.zone,
        status: s === 2 ? (idx % 2 === 0 ? "In Progress" : "Pending") : "Completed",
        startedAt: s === 2 && idx % 2 === 0 ? iso(createdAgo - 2 * HOUR) : s > 2 ? iso(createdAgo - 2 * HOUR) : null,
        completedAt: s > 2 ? iso(createdAgo - 3 * HOUR) : null,
        items: taskItems,
      };

      if (s > 2) {
        // Picking finished: consume reserved stock; inject a damaged/missing case.
        taskItems.forEach((ti, k) => {
          const it = items[k]!;
          const inv = inventory.find((iv) => iv.productId === ti.productId)!;
          let picked = ti.requiredQty;
          const incidentRoll = (idx + k) % 9;
          if (incidentRoll === 2 && ti.requiredQty > 2) {
            const bad = 1 + Math.floor(rng() * 2);
            picked = ti.requiredQty - bad;
            ti.status = "Damaged";
            ti.notes = `${bad} unit(s) found damaged in bin.`;
            inv.reservedQty -= bad;
            inv.damagedQty += bad;
            addException(createdAgo - 3 * HOUR, {
              orderId,
              productId: ti.productId,
              type: "Damaged Item",
              severity: "High",
              description: `${bad} damaged unit(s) of ${products.find((p) => p.id === ti.productId)!.name} found during picking (${task.taskCode}).`,
              status: "Open",
            });
            log(createdAgo - 3 * HOUR, picker.name, "Item Damaged", order.orderNumber, `${bad} damaged unit(s) reported while picking ${order.orderNumber}.`);
          } else if (incidentRoll === 5 && ti.requiredQty > 3) {
            const miss = 1 + Math.floor(rng() * 2);
            picked = ti.requiredQty - miss;
            ti.status = "Missing";
            ti.notes = `${miss} unit(s) missing from location.`;
            inv.reservedQty -= miss;
            inv.totalQty = Math.max(0, inv.totalQty - miss);
            addException(createdAgo - 3 * HOUR, {
              orderId,
              productId: ti.productId,
              type: "Missing Item",
              severity: "Critical",
              description: `${miss} unit(s) of ${products.find((p) => p.id === ti.productId)!.name} missing at ${ti.location}.`,
              status: "Investigating",
            });
            log(createdAgo - 3 * HOUR, picker.name, "Item Missing", order.orderNumber, `${miss} unit(s) missing while picking ${order.orderNumber}.`);
          } else {
            ti.status = "Picked";
          }
          ti.pickedQty = picked;
          it.pickedQty = picked;
          inv.reservedQty = Math.max(0, inv.reservedQty - picked);
          inv.totalQty = Math.max(0, inv.totalQty - picked);
        });
        log(createdAgo - 3 * HOUR, picker.name, "Picking Completed", order.orderNumber, `Picking task ${task.taskCode} completed.`);
      } else if (task.status === "In Progress") {
        log(createdAgo - 2 * HOUR, picker.name, "Picking Started", order.orderNumber, `Picking task ${task.taskCode} started in ${picker.zone}.`);
      }
      pickingTasks.push(task);
    }

    // Packing task
    if (s >= 3) {
      const packer = workers.filter((w) => w.role === "Packer")[idx % 2]!;
      const pkgCount = 1 + Math.floor(rng() * 3);
      const done = s > 3;
      packingTasks.push({
        id: `pak-${orderId}`,
        taskCode: `PA-${String(7300 + idx)}`,
        orderId,
        workerId: packer.id,
        station: `Station ${1 + (idx % 4)}`,
        packageCount: done ? pkgCount : idx % 2 === 0 ? pkgCount : 0,
        status: done ? "Completed" : idx % 2 === 0 ? "In Progress" : "Pending",
        startedAt: done || idx % 2 === 0 ? iso(createdAgo - 4 * HOUR) : null,
        completedAt: done ? iso(createdAgo - 5 * HOUR) : null,
      });
      if (done) {
        items.forEach((it) => (it.packedQty = it.pickedQty));
        log(createdAgo - 5 * HOUR, packer.name, "Packing Completed", order.orderNumber, `Order ${order.orderNumber} packed into ${pkgCount} package(s).`);
      }
    }

    // QC
    if (s >= 4) {
      const inspector = workers.filter((w) => w.role === "QC Inspector")[idx % 2]!;
      if (s > 4) {
        qualityChecks.push({
          id: `qcr-${orderId}`,
          orderId,
          inspectorId: inspector.id,
          result: "Passed",
          notes: "All packages sealed and labelled correctly.",
          timestamp: iso(createdAgo - 6 * HOUR),
        });
        log(createdAgo - 6 * HOUR, inspector.name, "QC Passed", order.orderNumber, `Quality check passed for ${order.orderNumber}.`);
      }
    }

    // Dispatch
    if (s >= 6) {
      const pkg = packingTasks.find((p) => p.orderId === orderId)?.packageCount ?? 1;
      dispatches.push({
        id: `dsp-${orderId}`,
        orderId,
        method: idx % 3 === 0 ? "Express Air" : idx % 3 === 1 ? "Standard Ground" : "Same-Day Courier",
        packageCount: pkg,
        trackingRef: `NX${String(880000 + idx * 37)}`,
        timestamp: iso(createdAgo - 7 * HOUR),
        status: s === 7 ? "Delivered" : "In Transit",
      });
      log(createdAgo - 7 * HOUR, "Nora Haddad", "Order Dispatched", order.orderNumber, `Order ${order.orderNumber} dispatched in ${pkg} package(s).`);
    }

    orderItems.push(...items);
  });

  // A seeded failed QC on an order currently in Quality Check.
  const qcOrder = orders.find((o) => o.status === "Quality Check")!;
  qualityChecks.push({
    id: `qcr-fail-${qcOrder.id}`,
    orderId: qcOrder.id,
    inspectorId: workers.find((w) => w.role === "QC Inspector")!.id,
    result: "Failed",
    notes: "Outer carton crushed on corner — repack required before dispatch.",
    timestamp: iso(2 * HOUR),
  });
  addException(2 * HOUR, {
    orderId: qcOrder.id,
    productId: null,
    type: "Quality Check Failure",
    severity: "High",
    description: `Quality check failed for ${qcOrder.orderNumber}: damaged outer packaging.`,
    status: "Open",
  });
  log(2 * HOUR, "Grace Lin", "QC Failed", qcOrder.orderNumber, `Quality check failed for ${qcOrder.orderNumber}.`);

  // Delayed fulfilment exceptions for overdue open orders.
  orders
    .filter((o) => new Date(o.promisedDispatchDate).getTime() < now && stageIndex[o.status] < 6)
    .slice(0, 2)
    .forEach((o) => {
      addException(1 * HOUR, {
        orderId: o.id,
        productId: null,
        type: "Delayed Fulfillment",
        severity: o.priority === "Urgent" ? "Critical" : "Medium",
        description: `${o.orderNumber} passed its promised dispatch window while in ${o.status}.`,
        status: "Open",
      });
    });

  // One resolved exception for history.
  addException(30 * HOUR, {
    orderId: orders[19]!.id,
    productId: products[4]!.id,
    type: "Quantity Mismatch",
    severity: "Medium",
    description: "Cycle count found a 3 unit variance against system quantity.",
    status: "Resolved",
    resolutionNotes: "Recount confirmed system quantity; variance closed by supervisor.",
  });

  activity.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return {
    products,
    inventory,
    customers,
    orders,
    orderItems,
    workers,
    pickingTasks,
    packingTasks,
    qualityChecks,
    dispatches,
    exceptions,
    activity,
    role: "Warehouse Manager",
  };
}
