import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BrainCircuit, CheckCircle2, FlaskConical, Info, ShieldCheck } from "lucide-react";
import { allocateOrder, logDecision, useWarehouseState } from "@/lib/store";
import { simulateAllocation, simulatableOrders, type RiskLevel, type SimulationResult } from "@/lib/simulator";
import { EmptyState, PageHeader, Panel, ProgressBar, dateOnly } from "@/components/warehouse/primitives";
import { OrderStatusBadge, Pill, PriorityBadge } from "@/components/warehouse/badges";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/simulator")({
  head: () => ({
    meta: [
      { title: "Decision Simulator — Nexus Warehouse" },
      {
        name: "description",
        content:
          "Simulate constrained stock allocation before committing: recommended action, downstream impact, risk level and a transparent rule breakdown.",
      },
      { property: "og:title", content: "Decision Simulator — Nexus Warehouse" },
      {
        property: "og:description",
        content: "Explainable, rule-based allocation decision support for warehouse managers.",
      },
    ],
  }),
  component: SimulatorPage,
});

const riskTone: Record<RiskLevel, "success" | "warning" | "danger"> = {
  Low: "success",
  Medium: "warning",
  High: "warning",
  Critical: "danger",
};

function SimulatorPage() {
  const state = useWarehouseState();
  const candidates = useMemo(() => simulatableOrders(state), [state]);
  const [orderId, setOrderId] = useState<string>("");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [committed, setCommitted] = useState<string | null>(null);

  const selected = orderId || candidates[0]?.order.id || "";
  const candidate = candidates.find((c) => c.order.id === selected);
  const preview = useMemo(
    () => (selected ? simulateAllocation(state, selected) : null),
    [state, selected],
  );

  const runSimulation = () => {
    const sim = simulateAllocation(state, selected);
    if (!sim) {
      toast.error("Select an open order to simulate.");
      return;
    }
    setResult(sim);
    setCommitted(null);
    toast.info(`Simulation complete for ${sim.order.orderNumber} — no data was changed.`);
  };

  const commit = () => {
    if (!result) return;
    if (result.kind === "hold") {
      logDecision({
        action: "Allocation Hold Committed",
        entity: result.order.orderNumber,
        description: `Manager committed the simulated decision to hold ${result.order.orderNumber} (score ${result.score}/100, risk ${result.riskLevel}). ${result.recommendation}`,
      });
      setCommitted(`${result.order.orderNumber} held — no stock allocated.`);
      toast.success(`Hold decision recorded for ${result.order.orderNumber}.`);
      setResult(null);
      return;
    }
    const res = allocateOrder(result.order.id);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    logDecision({
      action: "Decision Committed",
      entity: result.order.orderNumber,
      description: `Simulated allocation committed (score ${result.score}/100, risk ${result.riskLevel}). ${result.recommendation}`,
    });
    setCommitted(res.message);
    toast.success(res.message);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decision Simulator"
        subtitle="Test a constrained allocation decision before committing it to the warehouse."
        actions={
          <Pill tone="info">
            <FlaskConical className="size-3.5" />
            Deterministic rule engine — no external AI
          </Pill>
        }
      />

      {candidates.length === 0 ? (
        <EmptyState
          title="No open orders to simulate"
          description="Every order has already moved past allocation."
        />
      ) : (
        <>
          <Panel bodyClassName="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Open order
                </label>
                <Select
                  value={selected}
                  onValueChange={(v) => {
                    setOrderId(v);
                    setResult(null);
                    setCommitted(null);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select an order" /></SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.order.id} value={c.order.id}>
                        {c.order.orderNumber} · {c.order.priority}
                        {c.constrained ? ` · short ${c.outstanding - c.allocatable}` : " · stock OK"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="lg" onClick={runSimulation} className="gap-2">
                <BrainCircuit className="size-4" />
                Simulate Decision
              </Button>
              <p className="w-full text-xs text-muted-foreground sm:w-auto">
                <span className="font-medium text-foreground">Simulate</span> makes no permanent change ·{" "}
                <span className="font-medium text-foreground">Commit</span> updates the warehouse.
              </p>
            </div>
          </Panel>

          {committed ? (
            <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <div>
                <p className="text-sm font-semibold text-success">Decision committed</p>
                <p className="text-xs text-muted-foreground">{committed} Recorded in the Activity Log.</p>
              </div>
            </div>
          ) : null}

          {preview && candidate ? (
            <Panel title="Current Situation" description="Live data for the selected order — nothing has been changed">
              <div className="grid gap-4 lg:grid-cols-4">
                {[
                  ["Order", preview.order.orderNumber],
                  ["Customer", preview.customerName],
                  ["Promised dispatch", dateOnly(preview.order.promisedDispatchDate)],
                  [
                    "Deadline",
                    preview.hoursToDeadline < 0
                      ? `Overdue ${Math.abs(Math.round(preview.hoursToDeadline))}h`
                      : `${Math.round(preview.hoursToDeadline)}h remaining`,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border/70 bg-muted/25 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="mt-1 truncate text-sm font-medium">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <PriorityBadge priority={preview.order.priority} />
                <OrderStatusBadge status={preview.order.status} />
                <Pill tone={preview.totalShortfall > 0 ? "danger" : "success"}>
                  {preview.totalAllocatable}/{preview.totalOutstanding} outstanding units available
                </Pill>
              </div>

              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Required</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Shortfall</TableHead>
                      <TableHead>Other open orders on this SKU</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.lines.map((l) => (
                      <TableRow key={l.productId}>
                        <TableCell>
                          <p className="font-medium">{l.productName}</p>
                          <p className="text-xs text-muted-foreground">{l.sku}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{l.location}</TableCell>
                        <TableCell className="text-right">{l.requiredQty}</TableCell>
                        <TableCell className="text-right">{l.outstandingQty}</TableCell>
                        <TableCell className="text-right font-display font-semibold">{l.availableQty}</TableCell>
                        <TableCell
                          className={cn("text-right font-medium", l.shortfallQty > 0 ? "text-destructive" : "text-success")}
                        >
                          {l.shortfallQty}
                        </TableCell>
                        <TableCell>
                          {l.competingOrders.length === 0 ? (
                            <span className="text-xs text-muted-foreground">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {l.competingOrders.slice(0, 4).map((c) => (
                                <Link
                                  key={c.orderId}
                                  to="/orders/$orderId"
                                  params={{ orderId: c.orderId }}
                                  className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] hover:text-primary"
                                >
                                  {c.orderNumber} · {c.priority} · {c.outstandingQty}u
                                </Link>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          ) : null}

          {result ? (
            <div className="space-y-6">
              <Panel
                title="Recommended Action"
                description="Generated from deterministic allocation rules on the live warehouse data"
                actions={<Pill tone={riskTone[result.riskLevel]}>Risk: {result.riskLevel}</Pill>}
              >
                <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/8 p-4">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{result.recommendation}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{result.riskReason}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-52 flex-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Decision score</span>
                      <span className="font-display font-semibold text-foreground">{result.score}/100</span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar value={result.score} tone={result.score >= 60 ? "success" : "warning"} />
                    </div>
                  </div>
                  <Button onClick={commit} className="gap-2">
                    <CheckCircle2 className="size-4" />
                    Commit Decision
                  </Button>
                  <Button variant="ghost" onClick={() => setResult(null)}>
                    Discard simulation
                  </Button>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="size-3.5" />
                  This simulation has not changed any record. Committing applies the standard allocation workflow.
                </p>
              </Panel>

              <div className="grid gap-6 xl:grid-cols-2">
                <Panel title="Decision Impact" description="What happens if this decision is committed">
                  <dl className="space-y-3 text-sm">
                    {[
                      ["Units allocated", `${result.impact.unitsAllocated}`],
                      ["Remaining unfulfilled", `${result.impact.remainingUnfulfilled}`],
                      ["Orders placed at stock risk", `${result.impact.ordersAtStockRisk.length}`],
                      ["Orders potentially delayed", `${result.impact.ordersPotentiallyDelayed.length}`],
                      ["High-priority orders protected", `${result.impact.highPriorityProtected.length}`],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-display font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  {result.impact.ordersAtStockRisk.length ? (
                    <div className="mt-4 rounded-lg border border-destructive/25 bg-destructive/8 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-destructive">
                        <AlertTriangle className="size-3.5" /> Orders at stock risk
                      </p>
                      <ul className="mt-2 space-y-1.5 text-xs">
                        {result.impact.ordersAtStockRisk.slice(0, 6).map((o) => (
                          <li key={o.orderNumber} className="flex items-center justify-between gap-2">
                            <span className="font-medium">{o.orderNumber}</span>
                            <span className="text-muted-foreground">
                              {o.priority} · short {o.shortfall}u
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {result.impact.highPriorityProtected.length ? (
                    <div className="mt-3 rounded-lg border border-success/25 bg-success/8 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-success">
                        High-priority protected
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {result.impact.highPriorityProtected.map((o) => `${o.orderNumber} (${o.priority})`).join(", ")}
                      </p>
                    </div>
                  ) : null}
                </Panel>

                <Panel
                  title="Why this decision?"
                  description="Transparent rule factors — no AI, no black box"
                  bodyClassName="p-0"
                >
                  <ul className="divide-y divide-border">
                    {result.factors.map((f) => (
                      <li key={f.label} className="px-5 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{f.label}</p>
                          <span className="font-display text-sm font-semibold">
                            {f.points}
                            <span className="text-xs text-muted-foreground">/{f.max}</span>
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{f.detail}</p>
                        <div className="mt-2">
                          <ProgressBar value={(f.points / f.max) * 100} />
                        </div>
                      </li>
                    ))}
                    <li className="flex items-center justify-between gap-3 px-5 py-3">
                      <p className="text-sm font-semibold">Total decision score</p>
                      <span className="font-display text-base font-semibold">{result.score}/100</span>
                    </li>
                  </ul>
                  <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                    Scores at or above 60 favour allocating constrained stock to this order; below 60 the engine
                    protects competing higher-priority demand.
                  </p>
                </Panel>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
