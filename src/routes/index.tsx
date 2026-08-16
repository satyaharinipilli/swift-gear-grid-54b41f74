import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Clock,
  PackageCheck,
  PackageX,
  ShieldAlert,
  Truck,
} from "lucide-react";
import { useWarehouseState } from "@/lib/store";
import { kpis, pipelineCounts, priorityActions, orderRows } from "@/lib/selectors";
import { EmptyState, KpiCard, Panel, PageHeader, currency, relativeTime } from "@/components/warehouse/primitives";
import { OrderStatusBadge, Pill, PriorityBadge } from "@/components/warehouse/badges";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Warehouse Command Center — Nexus Warehouse" },
      {
        name: "description",
        content:
          "Live KPIs, fulfillment pipeline, priority actions and warehouse activity in one operations command center.",
      },
      { property: "og:title", content: "Warehouse Command Center — Nexus Warehouse" },
      {
        property: "og:description",
        content: "Live warehouse KPIs, fulfillment pipeline and priority operational alerts.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const state = useWarehouseState();
  const k = kpis(state);
  const pipeline = pipelineCounts(state);
  const actions = priorityActions(state);
  const rows = orderRows(state);
  const maxStage = Math.max(...pipeline.map((p) => p.count), 1);

  const urgentOpen = rows.filter(
    (r) => r.order.priority === "Urgent" && r.order.status !== "Completed" && r.order.status !== "Dispatched",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Command Center"
        subtitle={`Live view of ${state.orders.length} orders, ${state.products.length} SKUs and ${state.workers.length} floor workers.`}
        actions={
          <Pill tone="primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            Live operations feed
          </Pill>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="Total Orders" value={k.totalOrders} icon={ClipboardList} />
        <KpiCard label="Pending" value={k.pending} hint="Awaiting allocation" icon={Clock} tone="warning" />
        <KpiCard label="Picking" value={k.picking} icon={Boxes} tone="primary" />
        <KpiCard label="Packing" value={k.packing} icon={PackageCheck} tone="primary" />
        <KpiCard label="Ready to Dispatch" value={k.readyForDispatch} icon={Truck} tone="success" />
        <KpiCard label="Low Stock" value={k.lowStock} icon={AlertTriangle} tone="warning" />
        <KpiCard label="Out of Stock" value={k.outOfStock} icon={PackageX} tone="danger" />
        <KpiCard label="Open Exceptions" value={k.openExceptions} icon={ShieldAlert} tone="danger" />
      </div>

      <Panel title="Fulfillment Pipeline" description="Orders currently sitting at each stage of the lifecycle">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {pipeline.map((stage, i) => (
            <div key={stage.stage} className="rounded-lg border border-border/70 bg-muted/25 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-xl font-semibold">{stage.count}</span>
              </div>
              <p className="mt-1 text-xs font-medium">{stage.stage}</p>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${(stage.count / maxStage) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Priority Actions"
          description="Rule-based operational alerts requiring attention"
          bodyClassName="p-0"
        >
          {actions.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No priority actions" description="All orders and stock levels are healthy." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {actions.map((a) => (
                <li key={a.id}>
                  <Link
                    to={a.to}
                    className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        a.tone === "danger" ? "bg-destructive" : a.tone === "warning" ? "bg-warning" : "bg-info",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Warehouse Snapshot" description="Current operational posture">
          <dl className="space-y-3 text-sm">
            {[
              ["Open order value", currency(k.openValue)],
              ["Units reserved", `${k.reservedUnits}`],
              ["Damaged units held", `${k.damagedUnits}`],
              ["Orders in quality check", `${k.qc}`],
              ["Dispatched (24h)", `${k.dispatchedToday}`],
              ["Workers available", `${state.workers.filter((w) => w.available).length}/${state.workers.length}`],
              ["Active picking tasks", `${state.pickingTasks.filter((t) => t.status === "In Progress").length}`],
              ["Active packing tasks", `${state.packingTasks.filter((t) => t.status === "In Progress").length}`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-display font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {urgentOpen.length ? (
            <div className="mt-5 rounded-lg border border-destructive/25 bg-destructive/8 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
                Urgent orders in flight
              </p>
              <ul className="mt-2 space-y-1.5">
                {urgentOpen.slice(0, 4).map((r) => (
                  <li key={r.order.id} className="flex items-center justify-between gap-2 text-xs">
                    <Link
                      to="/orders/$orderId"
                      params={{ orderId: r.order.id }}
                      className="font-medium hover:text-primary"
                    >
                      {r.order.orderNumber}
                    </Link>
                    <OrderStatusBadge status={r.order.status} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Recent Activity" description="Audit trail of the last operational events" bodyClassName="p-0" className="xl:col-span-2">
          <ul className="divide-y divide-border">
            {state.activity.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                <span className="w-16 shrink-0 pt-0.5 text-[11px] text-muted-foreground">
                  {relativeTime(a.timestamp)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{a.action}</span>{" "}
                    <span className="text-muted-foreground">· {a.entity}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.description} — {a.actor}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Next Up" description="Highest priority open orders" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {rows
              .filter((r) => r.order.status !== "Completed" && r.order.status !== "Dispatched")
              .sort(
                (a, b) =>
                  ["Urgent", "High", "Normal", "Low"].indexOf(a.order.priority) -
                  ["Urgent", "High", "Normal", "Low"].indexOf(b.order.priority),
              )
              .slice(0, 7)
              .map((r) => (
                <li key={r.order.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to="/orders/$orderId"
                      params={{ orderId: r.order.id }}
                      className="text-sm font-medium hover:text-primary"
                    >
                      {r.order.orderNumber}
                    </Link>
                    <PriorityBadge priority={r.order.priority} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {r.customer.name} · {r.order.status} · {currency(r.order.totalValue)}
                  </p>
                </li>
              ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
