export type Role = "Warehouse Manager" | "Warehouse Worker";

export type OrderStatus =
  | "Created"
  | "Allocated"
  | "Picking"
  | "Packing"
  | "Quality Check"
  | "Ready for Dispatch"
  | "Dispatched"
  | "Completed";

export const ORDER_STATUSES: OrderStatus[] = [
  "Created",
  "Allocated",
  "Picking",
  "Packing",
  "Quality Check",
  "Ready for Dispatch",
  "Dispatched",
  "Completed",
];

export type Priority = "Low" | "Normal" | "High" | "Urgent";
export const PRIORITIES: Priority[] = ["Low", "Normal", "High", "Urgent"];

export type StockStatus = "Healthy" | "Low Stock" | "Out of Stock";

export type TaskStatus = "Pending" | "In Progress" | "Completed" | "Blocked";

export type PickItemStatus = "Pending" | "Picked" | "Partial" | "Missing" | "Damaged";

export type ExceptionType =
  | "Damaged Item"
  | "Missing Item"
  | "Quantity Mismatch"
  | "Stock Mismatch"
  | "Quality Check Failure"
  | "Delayed Fulfillment";

export type ExceptionSeverity = "Medium" | "High" | "Critical";
export type ExceptionStatus = "Open" | "Investigating" | "Resolved";

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  reorderThreshold: number;
}

export interface InventoryRecord {
  id: string;
  productId: string;
  zone: string;
  bin: string;
  totalQty: number;
  reservedQty: number;
  damagedQty: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: "Retail" | "Wholesale" | "Enterprise" | "Marketplace";
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  requestedQty: number;
  allocatedQty: number;
  pickedQty: number;
  packedQty: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  orderDate: string;
  promisedDispatchDate: string;
  priority: Priority;
  status: OrderStatus;
  totalValue: number;
}

export interface Worker {
  id: string;
  name: string;
  role: "Picker" | "Packer" | "QC Inspector" | "Dispatch Lead";
  zone: string;
  available: boolean;
}

export interface PickingTaskItem {
  id: string;
  taskId: string;
  productId: string;
  location: string;
  requiredQty: number;
  pickedQty: number;
  status: PickItemStatus;
  notes?: string;
}

export interface PickingTask {
  id: string;
  taskCode: string;
  orderId: string;
  workerId: string | null;
  zone: string;
  status: TaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  notes?: string;
  items: PickingTaskItem[];
}

export interface PackingTask {
  id: string;
  taskCode: string;
  orderId: string;
  workerId: string | null;
  station: string;
  packageCount: number;
  status: TaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  notes?: string;
}

export interface QualityCheck {
  id: string;
  orderId: string;
  inspectorId: string | null;
  result: "Passed" | "Failed";
  notes?: string;
  timestamp: string;
}

export interface DispatchRecord {
  id: string;
  orderId: string;
  method: "Standard Ground" | "Express Air" | "Same-Day Courier" | "Freight";
  packageCount: number;
  trackingRef: string;
  timestamp: string;
  status: "Dispatched" | "In Transit" | "Delivered";
}

export interface WarehouseException {
  id: string;
  code: string;
  orderId: string | null;
  productId: string | null;
  type: ExceptionType;
  severity: ExceptionSeverity;
  description: string;
  status: ExceptionStatus;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  description: string;
}

export interface WarehouseState {
  products: Product[];
  inventory: InventoryRecord[];
  customers: Customer[];
  orders: Order[];
  orderItems: OrderItem[];
  workers: Worker[];
  pickingTasks: PickingTask[];
  packingTasks: PackingTask[];
  qualityChecks: QualityCheck[];
  dispatches: DispatchRecord[];
  exceptions: WarehouseException[];
  activity: ActivityEntry[];
  role: Role;
}

export function availableQty(inv: InventoryRecord): number {
  return Math.max(0, inv.totalQty - inv.reservedQty - inv.damagedQty);
}

export function stockStatus(inv: InventoryRecord, product: Product): StockStatus {
  const avail = availableQty(inv);
  if (avail <= 0) return "Out of Stock";
  if (avail <= product.reorderThreshold) return "Low Stock";
  return "Healthy";
}
