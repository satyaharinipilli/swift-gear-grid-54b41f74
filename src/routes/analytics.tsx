import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useWarehouseState } from "@/lib/store";
import { inventoryRows, kpis, pipelineCounts } from "@/lib/selectors";
import { ORDER_STATUSES, PRIORITIES } from "@/lib/types";
import { KpiCard, PageHeader, Panel, currency } from "@/components/warehouse/primitives";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Nexus Warehouse" },
      {
        name: "description",
        content: "Operational analytics: orders by status and priority, inventory health, exceptions and dispatch activity.",
      },
      { property: "og:title", content: "Analytics — Nexus Warehouse" },
      { property: "og:description", content: "Foundation analytics built on live warehouse operations data." },
    ],
  }),
  component: AnalyticsPage,
});

const C = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-destructive)",
  info: "var(--color-info)",
};

const tooltipStyle = {
  backgroundColor: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.5rem",
  color: "var(--color-popover-foreground)",
  fontSize: "12px",
};

function AnalyticsPage() {
  const state = useWarehouseState();
  const k = kpis(state);
  const rows = inventoryRows(state);

  const byStatus = ORDER_STATUSES.map((s) => ({
    name: s,
    count: state.orders.filter((o) => o.status === s).length,
  }));
  const byPriority = PRIORITIES.map((p) => ({
    name: p,
    count: state.orders.filter((o) => o.priority === p).length,
  }));
  const health = [
    { name: "Healthy", value: rows.filter((r) => r.status === "Healthy").length, fill: C.success },
    { name: "Low Stock", value: rows.filter((r) => r.status === "Low Stock").length, fill: C.warning },
    { name: "Out of Stock", value: rows.filter((r) => r.status === "Out of Stock").length, fill: C.danger },
  ];
  const pipeline = pipelineCounts(state);
  const excByType = Array.from(new Set(state.exceptions.map((e) => e.type))).map((t) => ({
    name: t,
    count: state.exceptions.filter((e) => e.type === t).length,
  }));
  const excBySeverity = [
    { name: "Medium", value: state.exceptions.filter((e) => e.severity === "Medium").length, fill: C.warning },
    { name: "High", value: state.exceptions.filter((e) => e.severity === "High").length, fill: C.info },
    { name: "Critical", value: state.exceptions.filter((e) => e.severity === "Critical").length, fill: C.danger },
  ];
  const dispatchByDay = (() => {
    const buckets: Array<{ name: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400_000);
      const label = day.toLocaleDateString("en-US", { weekday: "short" });
      const count = state.dispatches.filter(
        (d) => new Date(d.timestamp).toDateString() === day.toDateString(),
      ).length;
      buckets.push({ name: label, count });
    }
    return buckets;
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Analytics"
        subtitle="Foundation metrics computed live from warehouse operations data."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Open order value" value={currency(k.openValue)} tone="primary" />
        <KpiCard label="Fulfilled orders" value={state.dispatches.length} tone="success" />
        <KpiCard label="Stock at risk" value={k.lowStock + k.outOfStock} tone="warning" />
        <KpiCard label="Open exceptions" value={k.openExceptions} tone="danger" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Orders by Status">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byStatus} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} interval={0} angle={-18} height={50} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)", opacity: 0.3 }} />
              <Bar dataKey="count" fill={C.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Orders by Priority">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byPriority} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)", opacity: 0.3 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {byPriority.map((p) => (
                  <Cell
                    key={p.name}
                    fill={p.name === "Urgent" ? C.danger : p.name === "High" ? C.warning : p.name === "Normal" ? C.info : C.primary}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Inventory Health">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={health} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {health.map((h) => (<Cell key={h.name} fill={h.fill} />))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Fulfillment Pipeline">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pipeline} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
              <YAxis type="category" dataKey="stage" width={110} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)", opacity: 0.3 }} />
              <Bar dataKey="count" fill={C.success} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Exceptions by Type">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={excByType} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} interval={0} angle={-18} height={60} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)", opacity: 0.3 }} />
              <Bar dataKey="count" fill={C.danger} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Exceptions by Severity">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={excBySeverity} dataKey="value" nameKey="name" outerRadius={90}>
                {excBySeverity.map((e) => (<Cell key={e.name} fill={e.fill} />))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Dispatch Activity (7 days)" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dispatchByDay} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)", opacity: 0.3 }} />
              <Bar dataKey="count" fill={C.info} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}
