import { availableQty, stockStatus, type OrderStatus, type WarehouseState } from "./types";
import { stageRank } from "./store";

export const PIPELINE_STAGES: OrderStatus[] = [
  "Created",
  "Allocated",
  "Picking",
  "Packing",
  "Quality Check",
  "Ready for Dispatch",
  "Dispatched",
];

export function inventoryRows(s: WarehouseState) {
  return s.inventory.map((inv) => {
    const product = s.products.find((p) => p.id === inv.productId)!;
    return {
      inv,
      product,
      available: availableQty(inv),
      status: stockStatus(inv, product),
    };
  });
}

export function orderRows(s: WarehouseState) {
  return s.orders.map((order) => {
    const items = s.orderItems.filter((i) => i.orderId === order.id);
    const requested = items.reduce((a, i) => a + i.requestedQty, 0) || 1;
    const packed = items.reduce((a, i) => a + i.packedQty, 0);
    const picked = items.reduce((a, i) => a + i.pickedQty, 0);
    const allocated = items.reduce((a, i) => a + i.allocatedQty, 0);
    const progress =
      order.status === "Dispatched" || order.status === "Completed"
        ? 100
        : Math.round(((allocated + picked + packed) / (requested * 3)) * 100);
    return {
      order,
      items,
      customer: s.customers.find((c) => c.id === order.customerId)!,
      progress,
      requested,
      allocated,
      picked,
      packed,
    };
  });
}

export function kpis(s: WarehouseState) {
  const rows = inventoryRows(s);
  return {
    totalOrders: s.orders.length,
    pending: s.orders.filter((o) => o.status === "Created").length,
    picking: s.orders.filter((o) => o.status === "Picking").length,
    packing: s.orders.filter((o) => o.status === "Packing").length,
    qc: s.orders.filter((o) => o.status === "Quality Check").length,
    readyForDispatch: s.orders.filter((o) => o.status === "Ready for Dispatch").length,
    dispatchedToday: s.dispatches.filter(
      (d) => Date.now() - new Date(d.timestamp).getTime() < 24 * 3600_000,
    ).length,
    lowStock: rows.filter((r) => r.status === "Low Stock").length,
    outOfStock: rows.filter((r) => r.status === "Out of Stock").length,
    damagedUnits: s.inventory.reduce((a, i) => a + i.damagedQty, 0),
    reservedUnits: s.inventory.reduce((a, i) => a + i.reservedQty, 0),
    openExceptions: s.exceptions.filter((e) => e.status !== "Resolved").length,
    openValue: s.orders
      .filter((o) => stageRank(o.status) < stageRank("Dispatched"))
      .reduce((a, o) => a + o.totalValue, 0),
  };
}

export type PriorityAction = {
  id: string;
  title: string;
  detail: string;
  tone: "danger" | "warning" | "info";
  to: string;
};

/** Rule-based operational alerts (Part 1 — no AI decisioning yet). */
export function priorityActions(s: WarehouseState): PriorityAction[] {
  const out: PriorityAction[] = [];
  const now = Date.now();

  s.orders
    .filter((o) => o.status === "Created" && (o.priority === "Urgent" || o.priority === "High"))
    .forEach((o) =>
      out.push({
        id: `alloc-${o.id}`,
        title: `${o.priority} order awaiting allocation`,
        detail: `${o.orderNumber} has not been allocated yet.`,
        tone: o.priority === "Urgent" ? "danger" : "warning",
        to: "/orders",
      }),
    );

  s.orders
    .filter(
      (o) =>
        stageRank(o.status) < stageRank("Dispatched") &&
        new Date(o.promisedDispatchDate).getTime() < now,
    )
    .forEach((o) =>
      out.push({
        id: `late-${o.id}`,
        title: "Order past promised dispatch",
        detail: `${o.orderNumber} is overdue while in ${o.status}.`,
        tone: "danger",
        to: "/orders",
      }),
    );

  inventoryRows(s)
    .filter((r) => r.status === "Out of Stock")
    .slice(0, 4)
    .forEach((r) =>
      out.push({
        id: `oos-${r.inv.id}`,
        title: "Out of stock",
        detail: `${r.product.name} (${r.product.sku}) has no available units.`,
        tone: "danger",
        to: "/inventory",
      }),
    );

  inventoryRows(s)
    .filter((r) => r.status === "Low Stock")
    .slice(0, 4)
    .forEach((r) =>
      out.push({
        id: `low-${r.inv.id}`,
        title: "Low stock below reorder point",
        detail: `${r.product.name}: ${r.available} available vs threshold ${r.product.reorderThreshold}.`,
        tone: "warning",
        to: "/inventory",
      }),
    );

  s.exceptions
    .filter((e) => e.status !== "Resolved")
    .slice(0, 6)
    .forEach((e) =>
      out.push({
        id: `exc-${e.id}`,
        title: e.type,
        detail: e.description,
        tone: e.severity === "Critical" ? "danger" : "warning",
        to: "/exceptions",
      }),
    );

  const toneRank = { danger: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => toneRank[a.tone] - toneRank[b.tone]).slice(0, 10);
}

export function pipelineCounts(s: WarehouseState) {
  return PIPELINE_STAGES.map((stage) => ({
    stage,
    count: s.orders.filter((o) =>
      stage === "Dispatched"
        ? o.status === "Dispatched" || o.status === "Completed"
        : o.status === stage,
    ).length,
  }));
}
