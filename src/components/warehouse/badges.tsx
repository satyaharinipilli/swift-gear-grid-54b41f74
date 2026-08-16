import { cn } from "@/lib/utils";
import type {
  ExceptionSeverity,
  ExceptionStatus,
  OrderStatus,
  PickItemStatus,
  Priority,
  StockStatus,
  TaskStatus,
} from "@/lib/types";

type Tone = "neutral" | "info" | "primary" | "success" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info/12 text-info border-info/30",
  primary: "bg-primary/12 text-primary border-primary/30",
  success: "bg-success/12 text-success border-success/30",
  warning: "bg-warning/12 text-warning border-warning/30",
  danger: "bg-destructive/15 text-destructive border-destructive/35",
};

export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const orderTone: Record<OrderStatus, Tone> = {
  Created: "neutral",
  Allocated: "info",
  Picking: "primary",
  Packing: "primary",
  "Quality Check": "warning",
  "Ready for Dispatch": "success",
  Dispatched: "success",
  Completed: "neutral",
};

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => (
  <Pill tone={orderTone[status]}>{status}</Pill>
);

const priorityTone: Record<Priority, Tone> = {
  Low: "neutral",
  Normal: "info",
  High: "warning",
  Urgent: "danger",
};

export const PriorityBadge = ({ priority }: { priority: Priority }) => (
  <Pill tone={priorityTone[priority]}>{priority}</Pill>
);

const stockTone: Record<StockStatus, Tone> = {
  Healthy: "success",
  "Low Stock": "warning",
  "Out of Stock": "danger",
};

export const StockBadge = ({ status }: { status: StockStatus }) => (
  <Pill tone={stockTone[status]}>{status}</Pill>
);

const taskTone: Record<TaskStatus, Tone> = {
  Pending: "neutral",
  "In Progress": "primary",
  Completed: "success",
  Blocked: "danger",
};

export const TaskBadge = ({ status }: { status: TaskStatus }) => (
  <Pill tone={taskTone[status]}>{status}</Pill>
);

const pickTone: Record<PickItemStatus, Tone> = {
  Pending: "neutral",
  Picked: "success",
  Partial: "warning",
  Missing: "danger",
  Damaged: "danger",
};

export const PickItemBadge = ({ status }: { status: PickItemStatus }) => (
  <Pill tone={pickTone[status]}>{status}</Pill>
);

const severityTone: Record<ExceptionSeverity, Tone> = {
  Medium: "warning",
  High: "warning",
  Critical: "danger",
};

export const SeverityBadge = ({ severity }: { severity: ExceptionSeverity }) => (
  <Pill tone={severityTone[severity]}>{severity}</Pill>
);

const excStatusTone: Record<ExceptionStatus, Tone> = {
  Open: "danger",
  Investigating: "warning",
  Resolved: "success",
};

export const ExceptionStatusBadge = ({ status }: { status: ExceptionStatus }) => (
  <Pill tone={excStatusTone[status]}>{status}</Pill>
);
