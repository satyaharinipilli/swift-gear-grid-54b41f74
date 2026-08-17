import { useSyncExternalStore } from "react";
import { buildSeedState } from "./seed";
import {
  availableQty,
  type ActivityEntry,
  type Order,
  type OrderStatus,
  type Priority,
  type Role,
  type WarehouseException,
  type WarehouseState,
} from "./types";

const STORAGE_KEY = "nexus-warehouse-state-v1";

let state: WarehouseState = buildSeedState();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — in-memory state still works */
  }
}

let hydrated = false;
export function hydrateFromStorage() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WarehouseState;
      if (parsed && Array.isArray(parsed.orders) && parsed.orders.length) {
        state = parsed;
      }
    }
  } catch {
    /* ignore corrupt state and keep the seed */
  }
  emit();
}

function emit() {
  listeners.forEach((l) => l());
}

function setState(updater: (draft: WarehouseState) => void) {
  const next: WarehouseState = JSON.parse(JSON.stringify(state));
  updater(next);
  state = next;
  persist();
  emit();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  return state;
}

export function useWarehouse<T>(selector: (s: WarehouseState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export function useWarehouseState(): WarehouseState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function resetDemoData() {
  state = buildSeedState();
  persist();
  emit();
}

export type ActionResult = { ok: boolean; message: string };

let idCounter = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++idCounter}`;

function pushActivity(
  draft: WarehouseState,
  entry: Omit<ActivityEntry, "id" | "timestamp"> & { timestamp?: string },
) {
  draft.activity.unshift({
    id: uid("act"),
    timestamp: entry.timestamp ?? new Date().toISOString(),
    actor: entry.actor,
    action: entry.action,
    entity: entry.entity,
    description: entry.description,
  });
}

function pushException(
  draft: WarehouseState,
  e: Omit<WarehouseException, "id" | "code" | "createdAt" | "updatedAt">,
) {
  const now = new Date().toISOString();
  draft.exceptions.unshift({
    ...e,
    id: uid("exc"),
    code: `EXC-${String(2000 + draft.exceptions.length)}`,
    createdAt: now,
    updatedAt: now,
  });
}

const STAGE_ORDER: OrderStatus[] = [
  "Created",
  "Allocated",
  "Picking",
  "Packing",
  "Quality Check",
  "Ready for Dispatch",
  "Dispatched",
  "Completed",
];
export const stageRank = (s: OrderStatus) => STAGE_ORDER.indexOf(s);

export function setRole(role: Role) {
  setState((d) => {
    d.role = role;
  });
}

function actor(draft: WarehouseState) {
  return draft.role;
}

/* ------------------------------- Allocation ------------------------------ */

export function allocateOrder(orderId: string): ActionResult {
  let result: ActionResult = { ok: false, message: "Order not found." };
  setState((d) => {
    const order = d.orders.find((o) => o.id === orderId);
    if (!order) return;
    if (stageRank(order.status) > stageRank("Allocated")) {
      result = { ok: false, message: `Order ${order.orderNumber} has already moved past allocation.` };
      return;
    }
    const items = d.orderItems.filter((i) => i.orderId === orderId);
    let allocatedNow = 0;
    let shortages = 0;
    items.forEach((item) => {
      const inv = d.inventory.find((iv) => iv.productId === item.productId);
      if (!inv) return;
      const need = Math.max(0, item.requestedQty - item.allocatedQty);
      const take = Math.min(need, availableQty(inv));
      if (take > 0) {
        item.allocatedQty += take;
        inv.reservedQty += take;
        allocatedNow += take;
      }
      if (item.allocatedQty < item.requestedQty) shortages += 1;
    });

    if (allocatedNow === 0 && items.every((i) => i.allocatedQty === 0)) {
      result = {
        ok: false,
        message: `No available stock to allocate for ${order.orderNumber}. Damaged and reserved units cannot be allocated.`,
      };
      pushException(d, {
        orderId,
        productId: items[0]?.productId ?? null,
        type: "Stock Mismatch",
        severity: order.priority === "Urgent" ? "Critical" : "High",
        description: `Allocation failed for ${order.orderNumber} — no available stock.`,
        status: "Open",
      });
      pushActivity(d, {
        actor: actor(d),
        action: "Allocation Failed",
        entity: order.orderNumber,
        description: `Allocation attempt for ${order.orderNumber} found no available stock.`,
      });
      return;
    }

    order.status = "Allocated";

    // Create the picking task if it does not exist yet.
    if (!d.pickingTasks.some((t) => t.orderId === orderId)) {
      const picker =
        d.workers.find((w) => w.role === "Picker" && w.available) ??
        d.workers.find((w) => w.role === "Picker")!;
      const taskId = uid("pck");
      d.pickingTasks.unshift({
        id: taskId,
        taskCode: `PK-${String(5000 + d.pickingTasks.length)}`,
        orderId,
        workerId: picker?.id ?? null,
        zone: picker?.zone ?? "Zone A",
        status: "Pending",
        startedAt: null,
        completedAt: null,
        items: items
          .filter((i) => i.allocatedQty > 0)
          .map((i) => {
            const inv = d.inventory.find((iv) => iv.productId === i.productId);
            return {
              id: uid("pti"),
              taskId,
              productId: i.productId,
              location: inv ? `${inv.zone} · ${inv.bin}` : "Unassigned",
              requiredQty: i.allocatedQty,
              pickedQty: 0,
              status: "Pending" as const,
            };
          }),
      });
    }

    if (shortages > 0) {
      pushException(d, {
        orderId,
        productId: items.find((i) => i.allocatedQty < i.requestedQty)?.productId ?? null,
        type: "Stock Mismatch",
        severity: order.priority === "Urgent" ? "Critical" : "High",
        description: `Partial allocation on ${order.orderNumber}: ${shortages} line item(s) short of requested quantity.`,
        status: "Open",
      });
    }

    pushActivity(d, {
      actor: actor(d),
      action: "Stock Allocated",
      entity: order.orderNumber,
      description: `${allocatedNow} unit(s) allocated to ${order.orderNumber}${shortages ? ` — ${shortages} line item(s) partially allocated` : " (full allocation)"}.`,
    });
    result = {
      ok: true,
      message: shortages
        ? `Partially allocated ${allocatedNow} unit(s) to ${order.orderNumber}.`
        : `Allocated ${allocatedNow} unit(s) to ${order.orderNumber}.`,
    };
  });
  return result;
}

/* -------------------------------- Picking -------------------------------- */

export function startPickingTask(taskId: string): ActionResult {
  let result: ActionResult = { ok: false, message: "Task not found." };
  setState((d) => {
    const task = d.pickingTasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status !== "Pending") {
      result = { ok: false, message: "Only pending tasks can be started." };
      return;
    }
    task.status = "In Progress";
    task.startedAt = new Date().toISOString();
    const order = d.orders.find((o) => o.id === task.orderId);
    if (order) {
      order.status = "Picking";
      pushActivity(d, {
        actor: actor(d),
        action: "Picking Started",
        entity: order.orderNumber,
        description: `Picking task ${task.taskCode} started in ${task.zone}.`,
      });
      result = { ok: true, message: `Picking started for ${order.orderNumber}.` };
    }
  });
  return result;
}

export function recordPickItem(
  taskId: string,
  itemId: string,
  payload: { status: "Picked" | "Partial" | "Missing" | "Damaged"; quantity: number; notes?: string | undefined },
): ActionResult {
  let result: ActionResult = { ok: false, message: "Pick line not found." };
  setState((d) => {
    const task = d.pickingTasks.find((t) => t.id === taskId);
    const line = task?.items.find((i) => i.id === itemId);
    if (!task || !line) return;
    if (task.status !== "In Progress") {
      result = { ok: false, message: "Start the picking task before recording lines." };
      return;
    }
    const qty = Math.max(0, Math.min(payload.quantity, line.requiredQty));
    const order = d.orders.find((o) => o.id === task.orderId)!;
    const product = d.products.find((p) => p.id === line.productId)!;
    line.pickedQty = payload.status === "Picked" ? line.requiredQty : qty;
    line.status = payload.status;
    line.notes = payload.notes;

    const shortfall = line.requiredQty - line.pickedQty;
    if ((payload.status === "Damaged" || payload.status === "Missing") && shortfall > 0) {
      const inv = d.inventory.find((iv) => iv.productId === line.productId);
      if (inv) {
        inv.reservedQty = Math.max(0, inv.reservedQty - shortfall);
        if (payload.status === "Damaged") inv.damagedQty += shortfall;
        else inv.totalQty = Math.max(0, inv.totalQty - shortfall);
      }
      pushException(d, {
        orderId: order.id,
        productId: line.productId,
        type: payload.status === "Damaged" ? "Damaged Item" : "Missing Item",
        severity: payload.status === "Missing" ? "Critical" : "High",
        description: `${shortfall} unit(s) of ${product.name} reported ${payload.status.toLowerCase()} at ${line.location} during ${task.taskCode}.`,
        status: "Open",
      });
      pushActivity(d, {
        actor: actor(d),
        action: payload.status === "Damaged" ? "Item Damaged" : "Item Missing",
        entity: order.orderNumber,
        description: `${shortfall} unit(s) of ${product.name} reported ${payload.status.toLowerCase()} — exception raised.`,
      });
    } else if (payload.status === "Partial" && shortfall > 0) {
      pushException(d, {
        orderId: order.id,
        productId: line.productId,
        type: "Quantity Mismatch",
        severity: "Medium",
        description: `Partial pick on ${order.orderNumber}: ${line.pickedQty}/${line.requiredQty} of ${product.name}.`,
        status: "Open",
      });
      pushActivity(d, {
        actor: actor(d),
        action: "Partial Pick Recorded",
        entity: order.orderNumber,
        description: `${line.pickedQty}/${line.requiredQty} units of ${product.name} picked.`,
      });
    } else {
      pushActivity(d, {
        actor: actor(d),
        action: "Item Picked",
        entity: order.orderNumber,
        description: `${line.pickedQty} unit(s) of ${product.name} picked from ${line.location}.`,
      });
    }
    result = { ok: true, message: `${product.name} recorded as ${payload.status}.` };
  });
  return result;
}

export function completePickingTask(taskId: string): ActionResult {
  let result: ActionResult = { ok: false, message: "Task not found." };
  setState((d) => {
    const task = d.pickingTasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status !== "In Progress") {
      result = { ok: false, message: "Only in-progress tasks can be completed." };
      return;
    }
    if (task.items.some((i) => i.status === "Pending")) {
      result = { ok: false, message: "Every pick line must be recorded before completing the task." };
      return;
    }
    const order = d.orders.find((o) => o.id === task.orderId)!;
    task.items.forEach((line) => {
      const item = d.orderItems.find((i) => i.orderId === order.id && i.productId === line.productId);
      if (item) item.pickedQty = line.pickedQty;
      const inv = d.inventory.find((iv) => iv.productId === line.productId);
      if (inv) {
        inv.reservedQty = Math.max(0, inv.reservedQty - line.pickedQty);
        inv.totalQty = Math.max(0, inv.totalQty - line.pickedQty);
      }
    });
    task.status = "Completed";
    task.completedAt = new Date().toISOString();
    order.status = "Packing";

    if (!d.packingTasks.some((p) => p.orderId === order.id)) {
      const packer = d.workers.find((w) => w.role === "Packer" && w.available) ?? d.workers.find((w) => w.role === "Packer");
      d.packingTasks.unshift({
        id: uid("pak"),
        taskCode: `PA-${String(8000 + d.packingTasks.length)}`,
        orderId: order.id,
        workerId: packer?.id ?? null,
        station: `Station ${1 + (d.packingTasks.length % 4)}`,
        packageCount: 0,
        status: "Pending",
        startedAt: null,
        completedAt: null,
      });
    }
    pushActivity(d, {
      actor: actor(d),
      action: "Picking Completed",
      entity: order.orderNumber,
      description: `Picking task ${task.taskCode} completed — order moved to Packing.`,
    });
    result = { ok: true, message: `Picking completed. ${order.orderNumber} moved to Packing.` };
  });
  return result;
}

/* -------------------------------- Packing -------------------------------- */

export function startPackingTask(taskId: string): ActionResult {
  let result: ActionResult = { ok: false, message: "Task not found." };
  setState((d) => {
    const task = d.packingTasks.find((t) => t.id === taskId);
    if (!task) return;
    const order = d.orders.find((o) => o.id === task.orderId)!;
    const pick = d.pickingTasks.find((p) => p.orderId === order.id);
    if (pick && pick.status !== "Completed") {
      result = { ok: false, message: "Picking must be completed before packing can start." };
      return;
    }
    if (task.status !== "Pending") {
      result = { ok: false, message: "Packing task is already started or completed." };
      return;
    }
    task.status = "In Progress";
    task.startedAt = new Date().toISOString();
    pushActivity(d, {
      actor: actor(d),
      action: "Packing Started",
      entity: order.orderNumber,
      description: `Packing started at ${task.station}.`,
    });
    result = { ok: true, message: `Packing started for ${order.orderNumber}.` };
  });
  return result;
}

export function updatePackageCount(taskId: string, count: number): ActionResult {
  let result: ActionResult = { ok: false, message: "Task not found." };
  setState((d) => {
    const task = d.packingTasks.find((t) => t.id === taskId);
    if (!task) return;
    if (count < 0 || !Number.isFinite(count)) {
      result = { ok: false, message: "Package count must be zero or greater." };
      return;
    }
    task.packageCount = Math.floor(count);
    result = { ok: true, message: `Package count set to ${task.packageCount}.` };
  });
  return result;
}

export function completePackingTask(taskId: string, notes?: string): ActionResult {
  let result: ActionResult = { ok: false, message: "Task not found." };
  setState((d) => {
    const task = d.packingTasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status !== "In Progress") {
      result = { ok: false, message: "Start the packing task before marking it packed." };
      return;
    }
    if (task.packageCount < 1) {
      result = { ok: false, message: "Record at least one package before completing packing." };
      return;
    }
    const order = d.orders.find((o) => o.id === task.orderId)!;
    task.status = "Completed";
    task.completedAt = new Date().toISOString();
    task.notes = notes;
    d.orderItems
      .filter((i) => i.orderId === order.id)
      .forEach((i) => {
        i.packedQty = i.pickedQty;
      });
    order.status = "Quality Check";
    pushActivity(d, {
      actor: actor(d),
      action: "Packing Completed",
      entity: order.orderNumber,
      description: `${order.orderNumber} packed into ${task.packageCount} package(s) — moved to Quality Check.`,
    });
    result = { ok: true, message: `${order.orderNumber} packed and sent to Quality Check.` };
  });
  return result;
}

/* ------------------------------ Quality check ----------------------------- */

export function recordQualityCheck(orderId: string, passed: boolean, notes?: string): ActionResult {
  let result: ActionResult = { ok: false, message: "Order not found." };
  setState((d) => {
    const order = d.orders.find((o) => o.id === orderId);
    if (!order) return;
    if (order.status !== "Quality Check") {
      result = { ok: false, message: `Quality check requires the order to be packed. ${order.orderNumber} is ${order.status}.` };
      return;
    }
    const inspector = d.workers.find((w) => w.role === "QC Inspector") ?? null;
    d.qualityChecks.unshift({
      id: uid("qcr"),
      orderId,
      inspectorId: inspector?.id ?? null,
      result: passed ? "Passed" : "Failed",
      notes,
      timestamp: new Date().toISOString(),
    });
    if (passed) {
      order.status = "Ready for Dispatch";
      pushActivity(d, {
        actor: actor(d),
        action: "QC Passed",
        entity: order.orderNumber,
        description: `Quality check passed — ${order.orderNumber} is ready for dispatch.`,
      });
      result = { ok: true, message: `${order.orderNumber} passed QC and is ready for dispatch.` };
    } else {
      order.status = "Packing";
      const pack = d.packingTasks.find((p) => p.orderId === orderId);
      if (pack) {
        pack.status = "In Progress";
        pack.completedAt = null;
      }
      pushException(d, {
        orderId,
        productId: null,
        type: "Quality Check Failure",
        severity: order.priority === "Urgent" ? "Critical" : "High",
        description: `Quality check failed for ${order.orderNumber}. ${notes ?? ""}`.trim(),
        status: "Open",
      });
      pushActivity(d, {
        actor: actor(d),
        action: "QC Failed",
        entity: order.orderNumber,
        description: `Quality check failed for ${order.orderNumber} — returned to packing, exception raised.`,
      });
      result = { ok: true, message: `${order.orderNumber} failed QC. Exception created and order returned to Packing.` };
    }
  });
  return result;
}

/* -------------------------------- Dispatch -------------------------------- */

export function dispatchOrder(
  orderId: string,
  method: "Standard Ground" | "Express Air" | "Same-Day Courier" | "Freight",
): ActionResult {
  let result: ActionResult = { ok: false, message: "Order not found." };
  setState((d) => {
    const order = d.orders.find((o) => o.id === orderId);
    if (!order) return;
    if (order.status === "Dispatched" || order.status === "Completed") {
      result = { ok: false, message: `${order.orderNumber} has already been dispatched.` };
      return;
    }
    if (order.status !== "Ready for Dispatch") {
      result = { ok: false, message: `${order.orderNumber} must pass quality check before dispatch.` };
      return;
    }
    const pack = d.packingTasks.find((p) => p.orderId === orderId);
    const packages = pack?.packageCount || 1;
    d.dispatches.unshift({
      id: uid("dsp"),
      orderId,
      method,
      packageCount: packages,
      trackingRef: `NX${Math.floor(100000 + Math.random() * 899999)}`,
      timestamp: new Date().toISOString(),
      status: "Dispatched",
    });
    order.status = "Dispatched";
    pushActivity(d, {
      actor: actor(d),
      action: "Order Dispatched",
      entity: order.orderNumber,
      description: `${order.orderNumber} dispatched via ${method} in ${packages} package(s).`,
    });
    result = { ok: true, message: `${order.orderNumber} dispatched via ${method}.` };
  });
  return result;
}

export function completeOrder(orderId: string): ActionResult {
  let result: ActionResult = { ok: false, message: "Order not found." };
  setState((d) => {
    const order = d.orders.find((o) => o.id === orderId);
    if (!order) return;
    if (order.status !== "Dispatched") {
      result = { ok: false, message: "Only dispatched orders can be completed." };
      return;
    }
    order.status = "Completed";
    const dsp = d.dispatches.find((x) => x.orderId === orderId);
    if (dsp) dsp.status = "Delivered";
    pushActivity(d, {
      actor: actor(d),
      action: "Order Completed",
      entity: order.orderNumber,
      description: `${order.orderNumber} confirmed delivered and closed.`,
    });
    result = { ok: true, message: `${order.orderNumber} marked completed.` };
  });
  return result;
}

/* ------------------------------- Exceptions ------------------------------- */

export function updateException(
  id: string,
  payload: { status: WarehouseException["status"]; resolutionNotes?: string },
): ActionResult {
  let result: ActionResult = { ok: false, message: "Exception not found." };
  setState((d) => {
    const exc = d.exceptions.find((e) => e.id === id);
    if (!exc) return;
    if (payload.status === "Resolved" && !payload.resolutionNotes?.trim()) {
      result = { ok: false, message: "Resolution notes are required to resolve an exception." };
      return;
    }
    exc.status = payload.status;
    exc.resolutionNotes = payload.resolutionNotes ?? exc.resolutionNotes;
    exc.updatedAt = new Date().toISOString();
    pushActivity(d, {
      actor: actor(d),
      action: payload.status === "Resolved" ? "Exception Resolved" : "Exception Updated",
      entity: exc.code,
      description: `${exc.type} exception ${exc.code} set to ${payload.status}.`,
    });
    result = { ok: true, message: `${exc.code} set to ${payload.status}.` };
  });
  return result;
}

/* ------------------------------ Order creation ---------------------------- */

export function createOrder(input: {
  customerId: string;
  priority: Priority;
  promisedDispatchDate: string;
  lines: Array<{ productId: string; quantity: number }>;
}): ActionResult {
  let result: ActionResult = { ok: false, message: "Unable to create order." };
  setState((d) => {
    const customer = d.customers.find((c) => c.id === input.customerId);
    const lines = input.lines.filter((l) => l.productId && l.quantity > 0);
    if (!customer) {
      result = { ok: false, message: "Select a customer." };
      return;
    }
    if (!lines.length) {
      result = { ok: false, message: "Add at least one line item with a quantity above zero." };
      return;
    }
    const orderId = uid("ord");
    const orderNumber = `SO-${String(24900 + d.orders.length)}`;
    let total = 0;
    lines.forEach((l, k) => {
      const product = d.products.find((p) => p.id === l.productId)!;
      total += product.price * l.quantity;
      d.orderItems.push({
        id: `${orderId}-i${k}`,
        orderId,
        productId: l.productId,
        requestedQty: Math.floor(l.quantity),
        allocatedQty: 0,
        pickedQty: 0,
        packedQty: 0,
      });
    });
    const order: Order = {
      id: orderId,
      orderNumber,
      customerId: customer.id,
      orderDate: new Date().toISOString(),
      promisedDispatchDate: new Date(input.promisedDispatchDate).toISOString(),
      priority: input.priority,
      status: "Created",
      totalValue: Math.round(total * 100) / 100,
    };
    d.orders.unshift(order);
    pushActivity(d, {
      actor: actor(d),
      action: "Order Created",
      entity: orderNumber,
      description: `${orderNumber} created for ${customer.name} with ${lines.length} line item(s).`,
    });
    result = { ok: true, message: `${orderNumber} created.` };
  });
  return result;
}

export function setOrderPriority(orderId: string, priority: Priority): ActionResult {
  let result: ActionResult = { ok: false, message: "Order not found." };
  setState((d) => {
    const order = d.orders.find((o) => o.id === orderId);
    if (!order) return;
    const prev = order.priority;
    order.priority = priority;
    pushActivity(d, {
      actor: actor(d),
      action: "Priority Updated",
      entity: order.orderNumber,
      description: `Priority changed from ${prev} to ${priority}.`,
    });
    result = { ok: true, message: `Priority set to ${priority}.` };
  });
  return result;
}
