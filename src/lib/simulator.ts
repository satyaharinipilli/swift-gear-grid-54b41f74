import { availableQty, type Order, type Priority, type WarehouseState } from "./types";
import { stageRank } from "./store";

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export type DecisionKind = "allocate-full" | "allocate-partial" | "hold";

export interface LineScenario {
  productId: string;
  sku: string;
  productName: string;
  location: string;
  requiredQty: number;
  alreadyAllocated: number;
  outstandingQty: number;
  availableQty: number;
  allocatableQty: number;
  shortfallQty: number;
  competingOrders: Array<{
    orderId: string;
    orderNumber: string;
    priority: Priority;
    status: string;
    outstandingQty: number;
    promisedDispatchDate: string;
    hoursToDeadline: number;
  }>;
}

export interface ScoreFactor {
  label: string;
  detail: string;
  points: number;
  max: number;
}

export interface SimulationResult {
  order: Order;
  customerName: string;
  hoursToDeadline: number;
  lines: LineScenario[];
  totalOutstanding: number;
  totalAllocatable: number;
  totalShortfall: number;
  fillRate: number;
  score: number;
  factors: ScoreFactor[];
  kind: DecisionKind;
  recommendation: string;
  riskLevel: RiskLevel;
  riskReason: string;
  impact: {
    unitsAllocated: number;
    remainingUnfulfilled: number;
    ordersAtStockRisk: Array<{ orderNumber: string; priority: Priority; shortfall: number }>;
    ordersPotentiallyDelayed: Array<{ orderNumber: string; priority: Priority; hoursToDeadline: number }>;
    highPriorityProtected: Array<{ orderNumber: string; priority: Priority }>;
  };
}

const PRIORITY_POINTS: Record<Priority, number> = { Urgent: 40, High: 30, Normal: 16, Low: 6 };
const PRIORITY_RANK: Record<Priority, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };

export const hoursUntil = (iso: string) => (new Date(iso).getTime() - Date.now()) / 3_600_000;

export function isOpenOrder(o: Order) {
  return stageRank(o.status) < stageRank("Picking");
}

/** Orders that can still be simulated for allocation (not yet past allocation). */
export function simulatableOrders(s: WarehouseState) {
  return s.orders
    .filter(isOpenOrder)
    .map((order) => {
      const items = s.orderItems.filter((i) => i.orderId === order.id);
      const outstanding = items.reduce((a, i) => a + Math.max(0, i.requestedQty - i.allocatedQty), 0);
      const allocatable = items.reduce((a, i) => {
        const inv = s.inventory.find((iv) => iv.productId === i.productId);
        const need = Math.max(0, i.requestedQty - i.allocatedQty);
        return a + Math.min(need, inv ? availableQty(inv) : 0);
      }, 0);
      return { order, outstanding, allocatable, constrained: outstanding > allocatable };
    })
    .filter((r) => r.outstanding > 0)
    .sort(
      (a, b) =>
        Number(b.constrained) - Number(a.constrained) ||
        PRIORITY_RANK[a.order.priority] - PRIORITY_RANK[b.order.priority] ||
        new Date(a.order.promisedDispatchDate).getTime() - new Date(b.order.promisedDispatchDate).getTime(),
    );
}

/** Pure, deterministic simulation — never mutates state. */
export function simulateAllocation(s: WarehouseState, orderId: string): SimulationResult | null {
  const order = s.orders.find((o) => o.id === orderId);
  if (!order) return null;
  const customerName = s.customers.find((c) => c.id === order.customerId)?.name ?? "Unknown customer";
  const items = s.orderItems.filter((i) => i.orderId === orderId);

  const lines: LineScenario[] = items.map((item) => {
    const product = s.products.find((p) => p.id === item.productId)!;
    const inv = s.inventory.find((iv) => iv.productId === item.productId);
    const avail = inv ? availableQty(inv) : 0;
    const outstanding = Math.max(0, item.requestedQty - item.allocatedQty);
    const allocatable = Math.min(outstanding, avail);
    const competing = s.orders
      .filter((o) => o.id !== orderId && isOpenOrder(o))
      .map((o) => {
        const line = s.orderItems.find((i) => i.orderId === o.id && i.productId === item.productId);
        const out = line ? Math.max(0, line.requestedQty - line.allocatedQty) : 0;
        return {
          orderId: o.id,
          orderNumber: o.orderNumber,
          priority: o.priority,
          status: o.status as string,
          outstandingQty: out,
          promisedDispatchDate: o.promisedDispatchDate,
          hoursToDeadline: hoursUntil(o.promisedDispatchDate),
        };
      })
      .filter((c) => c.outstandingQty > 0)
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.hoursToDeadline - b.hoursToDeadline);

    return {
      productId: item.productId,
      sku: product.sku,
      productName: product.name,
      location: inv ? `${inv.zone} · ${inv.bin}` : "Unassigned",
      requiredQty: item.requestedQty,
      alreadyAllocated: item.allocatedQty,
      outstandingQty: outstanding,
      availableQty: avail,
      allocatableQty: allocatable,
      shortfallQty: outstanding - allocatable,
      competingOrders: competing,
    };
  });

  const totalOutstanding = lines.reduce((a, l) => a + l.outstandingQty, 0);
  const totalAllocatable = lines.reduce((a, l) => a + l.allocatableQty, 0);
  const totalShortfall = totalOutstanding - totalAllocatable;
  const fillRate = totalOutstanding === 0 ? 1 : totalAllocatable / totalOutstanding;
  const hours = hoursUntil(order.promisedDispatchDate);

  /* ------------------------------ Scoring ------------------------------- */
  const factors: ScoreFactor[] = [];

  factors.push({
    label: "Order priority",
    detail: `${order.priority} priority order`,
    points: PRIORITY_POINTS[order.priority],
    max: 40,
  });

  const deadlinePoints = hours < 0 ? 30 : hours < 24 ? 24 : hours < 72 ? 14 : 6;
  factors.push({
    label: "Dispatch deadline",
    detail:
      hours < 0
        ? `Overdue by ${Math.abs(Math.round(hours))}h`
        : `${Math.round(hours)}h until promised dispatch`,
    points: deadlinePoints,
    max: 30,
  });

  const stockPoints = fillRate >= 1 ? 20 : fillRate >= 0.6 ? 14 : fillRate >= 0.3 ? 9 : 4;
  factors.push({
    label: "Stock coverage",
    detail: `${totalAllocatable}/${totalOutstanding} outstanding units available now (${Math.round(fillRate * 100)}%)`,
    points: stockPoints,
    max: 20,
  });

  const competitors = lines.flatMap((l) => l.competingOrders);
  const higherPriority = competitors.filter((c) => PRIORITY_RANK[c.priority] < PRIORITY_RANK[order.priority]);
  const urgentCompetitors = competitors.filter(
    (c) => c.priority === "Urgent" || c.priority === "High" || c.hoursToDeadline < 24,
  );
  const impactPoints = higherPriority.length > 0 ? 2 : urgentCompetitors.length > 1 ? 5 : competitors.length > 0 ? 7 : 10;
  factors.push({
    label: "Impact on other orders",
    detail:
      higherPriority.length > 0
        ? `${higherPriority.length} higher-priority order(s) compete for the same SKUs`
        : competitors.length > 0
          ? `${competitors.length} other open order(s) need the same SKUs, none higher priority`
          : "No other open order competes for these SKUs",
    points: impactPoints,
    max: 10,
  });

  const score = factors.reduce((a, f) => a + f.points, 0);

  /* --------------------------- Recommendation --------------------------- */
  let kind: DecisionKind;
  let recommendation: string;

  if (totalOutstanding === 0) {
    kind = "hold";
    recommendation = `${order.orderNumber} has nothing outstanding to allocate.`;
  } else if (totalShortfall === 0) {
    kind = "allocate-full";
    recommendation = `Allocate all ${totalAllocatable} outstanding units to ${order.orderNumber} — stock fully covers this order.`;
  } else if (totalAllocatable === 0) {
    kind = "hold";
    recommendation = `Hold ${order.orderNumber} — no allocatable stock. Receive stock before committing an allocation.`;
  } else if (score >= 60) {
    kind = "allocate-partial";
    recommendation = `Allocate the ${totalAllocatable} available unit(s) to ${order.orderNumber} now and carry ${totalShortfall} unit(s) as backorder.`;
  } else if (higherPriority.length > 0) {
    kind = "hold";
    recommendation = `Hold ${order.orderNumber} — protect ${higherPriority[0]!.orderNumber} (${higherPriority[0]!.priority}) which needs the same constrained stock.`;
  } else {
    kind = "allocate-partial";
    recommendation = `Allocate the ${totalAllocatable} available unit(s) to ${order.orderNumber}; remaining ${totalShortfall} unit(s) stay unfulfilled until replenishment.`;
  }

  /* ------------------------------- Impact ------------------------------- */
  const unitsAllocated = kind === "hold" ? 0 : totalAllocatable;
  const remainingUnfulfilled = totalOutstanding - unitsAllocated;

  const atRisk = new Map<string, { orderNumber: string; priority: Priority; shortfall: number }>();
  const delayed = new Map<string, { orderNumber: string; priority: Priority; hoursToDeadline: number }>();
  const protectedOrders = new Map<string, { orderNumber: string; priority: Priority }>();

  lines.forEach((l) => {
    const consumed = kind === "hold" ? 0 : l.allocatableQty;
    const remainingStock = Math.max(0, l.availableQty - consumed);
    let pool = remainingStock;
    l.competingOrders.forEach((c) => {
      const covered = Math.min(pool, c.outstandingQty);
      pool -= covered;
      const shortfall = c.outstandingQty - covered;
      if (shortfall > 0) {
        const prev = atRisk.get(c.orderId);
        atRisk.set(c.orderId, {
          orderNumber: c.orderNumber,
          priority: c.priority,
          shortfall: (prev?.shortfall ?? 0) + shortfall,
        });
        if (c.hoursToDeadline < 48) {
          delayed.set(c.orderId, {
            orderNumber: c.orderNumber,
            priority: c.priority,
            hoursToDeadline: c.hoursToDeadline,
          });
        }
      } else if (c.priority === "Urgent" || c.priority === "High") {
        protectedOrders.set(c.orderId, { orderNumber: c.orderNumber, priority: c.priority });
      }
    });
  });

  if (kind === "hold" && higherPriority.length > 0) {
    higherPriority.forEach((c) => protectedOrders.set(c.orderId, { orderNumber: c.orderNumber, priority: c.priority }));
  }

  /* ------------------------------- Risk --------------------------------- */
  const riskyHighPriority = [...atRisk.values()].filter((o) => o.priority === "Urgent" || o.priority === "High").length;
  let risk = 0;
  if (remainingUnfulfilled > 0) risk += fillRate < 0.3 ? 3 : fillRate < 0.7 ? 2 : 1;
  if (hours < 0) risk += 2;
  else if (hours < 24) risk += 1;
  if (order.priority === "Urgent") risk += 1;
  risk += Math.min(2, riskyHighPriority);

  const riskLevel: RiskLevel = risk >= 6 ? "Critical" : risk >= 4 ? "High" : risk >= 2 ? "Medium" : "Low";
  const riskReason =
    risk === 0
      ? "Stock fully covers the order with no downstream impact."
      : [
          remainingUnfulfilled > 0 ? `${remainingUnfulfilled} unit(s) remain unfulfilled` : null,
          hours < 0 ? "order is past its promised dispatch date" : hours < 24 ? "dispatch deadline is inside 24h" : null,
          riskyHighPriority > 0 ? `${riskyHighPriority} high-priority order(s) left short of stock` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return {
    order,
    customerName,
    hoursToDeadline: hours,
    lines,
    totalOutstanding,
    totalAllocatable,
    totalShortfall,
    fillRate,
    score,
    factors,
    kind,
    recommendation,
    riskLevel,
    riskReason,
    impact: {
      unitsAllocated,
      remainingUnfulfilled,
      ordersAtStockRisk: [...atRisk.values()].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]),
      ordersPotentiallyDelayed: [...delayed.values()].sort((a, b) => a.hoursToDeadline - b.hoursToDeadline),
      highPriorityProtected: [...protectedOrders.values()],
    },
  };
}

/** Compact dashboard warning: important open orders competing for constrained stock. */
export function stockAllocationRisk(s: WarehouseState) {
  const constrained = simulatableOrders(s).filter(
    (r) => r.constrained && (r.order.priority === "Urgent" || r.order.priority === "High"),
  );
  if (!constrained.length) return null;
  const top = constrained[0]!;
  return {
    count: constrained.length,
    orderId: top.order.id,
    orderNumber: top.order.orderNumber,
    priority: top.order.priority,
    shortfall: top.outstanding - top.allocatable,
  };
}
