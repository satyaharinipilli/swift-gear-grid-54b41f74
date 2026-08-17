import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { completeOrder, dispatchOrder, recordQualityCheck, useWarehouseState } from "@/lib/store";
import { EmptyState, KpiCard, PageHeader, Panel, currency, dateTime, relativeTime } from "@/components/warehouse/primitives";
import { OrderStatusBadge, Pill, PriorityBadge } from "@/components/warehouse/badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Method = "Standard Ground" | "Express Air" | "Same-Day Courier" | "Freight";
const METHODS: Method[] = ["Standard Ground", "Express Air", "Same-Day Courier", "Freight"];

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "Quality & Dispatch — Nexus Warehouse" },
      {
        name: "description",
        content: "Run quality checks on packed orders and dispatch approved shipments with tracking references.",
      },
      { property: "og:title", content: "Quality & Dispatch — Nexus Warehouse" },
      { property: "og:description", content: "QC pass/fail workflow and dispatch tracking for fulfilled orders." },
    ],
  }),
  component: QualityDispatchPage,
});

function QualityDispatchPage() {
  const state = useWarehouseState();
  const qcQueue = state.orders.filter((o) => o.status === "Quality Check");
  const readyQueue = state.orders.filter((o) => o.status === "Ready for Dispatch");

  return (
    <div className="space-y-6">
      <PageHeader title="Quality & Dispatch" subtitle="Final inspection and outbound shipping control." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Awaiting QC" value={qcQueue.length} tone="warning" />
        <KpiCard label="Ready for dispatch" value={readyQueue.length} tone="success" />
        <KpiCard label="Dispatched" value={state.dispatches.length} tone="primary" />
        <KpiCard
          label="QC failures"
          value={state.qualityChecks.filter((q) => q.result === "Failed").length}
          tone="danger"
        />
      </div>

      <Tabs defaultValue="qc">
        <TabsList>
          <TabsTrigger value="qc">Quality Check</TabsTrigger>
          <TabsTrigger value="dispatch">Ready for Dispatch</TabsTrigger>
          <TabsTrigger value="records">Dispatch Records</TabsTrigger>
        </TabsList>

        <TabsContent value="qc" className="mt-4">
          <QcSection />
        </TabsContent>

        <TabsContent value="dispatch" className="mt-4">
          <DispatchSection />
        </TabsContent>

        <TabsContent value="records" className="mt-4">
          <Panel bodyClassName="p-0">
            {state.dispatches.length === 0 ? (
              <div className="p-5"><EmptyState title="No dispatch records yet" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Packages</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Dispatched</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.dispatches.map((d) => {
                    const order = state.orders.find((o) => o.id === d.orderId);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{order?.orderNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{d.method}</TableCell>
                        <TableCell>{d.packageCount}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{d.trackingRef}</TableCell>
                        <TableCell className="text-muted-foreground">{dateTime(d.timestamp)}</TableCell>
                        <TableCell><Pill tone={d.status === "Delivered" ? "success" : "info"}>{d.status}</Pill></TableCell>
                        <TableCell className="text-right">
                          {order?.status === "Dispatched" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const res = completeOrder(order.id);
                                res.ok ? toast.success(res.message) : toast.error(res.message);
                              }}
                            >
                              Mark delivered
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QcSection() {
  const state = useWarehouseState();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const queue = state.orders.filter((o) => o.status === "Quality Check");

  if (!queue.length) {
    return (
      <Panel><EmptyState title="Quality check queue is clear" description="Packed orders appear here automatically." /></Panel>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {queue.map((order) => {
        const customer = state.customers.find((c) => c.id === order.customerId)!;
        const pack = state.packingTasks.find((p) => p.orderId === order.id);
        const history = state.qualityChecks.filter((q) => q.orderId === order.id);
        return (
          <Panel key={order.id} title={order.orderNumber} description={`${customer.name} · ${pack?.packageCount ?? 0} package(s)`}>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={order.priority} />
              <OrderStatusBadge status={order.status} />
            </div>
            <Textarea
              className="mt-3"
              rows={2}
              placeholder="Inspection notes"
              value={notes[order.id] ?? ""}
              onChange={(e) => setNotes((s) => ({ ...s, [order.id]: e.target.value }))}
            />
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => {
                  const res = recordQualityCheck(order.id, true, notes[order.id]);
                  res.ok ? toast.success(res.message) : toast.error(res.message);
                }}
              >
                Pass QC
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const res = recordQualityCheck(order.id, false, notes[order.id]);
                  res.ok ? toast.success(res.message) : toast.error(res.message);
                }}
              >
                Fail QC
              </Button>
            </div>
            {history.length ? (
              <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className={h.result === "Passed" ? "text-success" : "text-destructive"}>{h.result}</span>{" "}
                    · {relativeTime(h.timestamp)} · {h.notes ?? "No notes"}
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>
        );
      })}
    </div>
  );
}

function DispatchSection() {
  const state = useWarehouseState();
  const [methods, setMethods] = useState<Record<string, Method>>({});
  const queue = state.orders.filter((o) => o.status === "Ready for Dispatch");

  if (!queue.length) {
    return <Panel><EmptyState title="Nothing ready for dispatch" description="Orders appear here once QC passes." /></Panel>;
  }

  return (
    <Panel bodyClassName="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Packages</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Ready since</TableHead>
            <TableHead className="w-48">Method</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {queue.map((order) => {
            const customer = state.customers.find((c) => c.id === order.customerId)!;
            const pack = state.packingTasks.find((p) => p.orderId === order.id);
            const qc = state.qualityChecks.find((q) => q.orderId === order.id && q.result === "Passed");
            const method = methods[order.id] ?? "Standard Ground";
            return (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.orderNumber}</TableCell>
                <TableCell className="text-muted-foreground">{customer.name}</TableCell>
                <TableCell><PriorityBadge priority={order.priority} /></TableCell>
                <TableCell>{pack?.packageCount ?? 1}</TableCell>
                <TableCell>{currency(order.totalValue)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {qc ? relativeTime(qc.timestamp) : "—"}
                </TableCell>
                <TableCell>
                  <Select value={method} onValueChange={(v) => setMethods((s) => ({ ...s, [order.id]: v as Method }))}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm">Dispatch</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Dispatch {order.orderNumber}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This creates a dispatch record via {method}, closes the fulfillment cycle and writes an
                          activity log entry. Dispatched orders cannot be dispatched again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            const res = dispatchOrder(order.id, method);
                            res.ok ? toast.success(res.message) : toast.error(res.message);
                          }}
                        >
                          Confirm dispatch
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Panel>
  );
}
