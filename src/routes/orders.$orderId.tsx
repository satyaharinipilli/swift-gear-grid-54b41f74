import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { allocateOrder, setOrderPriority, stageRank, useWarehouseState } from "@/lib/store";
import { PIPELINE_STAGES } from "@/lib/selectors";
import { PRIORITIES, type Priority } from "@/lib/types";
import { EmptyState, PageHeader, Panel, currency, dateTime } from "@/components/warehouse/primitives";
import { OrderStatusBadge, Pill, PriorityBadge } from "@/components/warehouse/badges";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Order Detail — Nexus Warehouse" },
      { name: "description", content: "Order items, fulfillment timeline and order-specific activity history." },
      { property: "og:title", content: "Order Detail — Nexus Warehouse" },
      { property: "og:description", content: "Track allocation, picking, packing, QC and dispatch for an order." },
    ],
  }),
  component: OrderDetail,
});

function OrderDetail() {
  const { orderId } = useParams({ from: "/orders/$orderId" });
  const state = useWarehouseState();
  const order = state.orders.find((o) => o.id === orderId);

  if (!order) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order not found" />
        <EmptyState title="This order no longer exists" description="It may have been removed by a demo reset." />
      </div>
    );
  }

  const customer = state.customers.find((c) => c.id === order.customerId)!;
  const items = state.orderItems.filter((i) => i.orderId === order.id);
  const activity = state.activity.filter((a) => a.entity === order.orderNumber);
  const exceptions = state.exceptions.filter((e) => e.orderId === order.id);
  const dispatch = state.dispatches.find((d) => d.orderId === order.id);
  const currentRank = stageRank(order.status);

  return (
    <div className="space-y-6">
      <Link to="/orders" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to orders
      </Link>
      <PageHeader
        title={order.orderNumber}
        subtitle={`${customer.name} · ${customer.type} · ${currency(order.totalValue)}`}
        actions={
          <div className="flex items-center gap-2">
            <PriorityBadge priority={order.priority} />
            <OrderStatusBadge status={order.status} />
            <Select
              value={order.priority}
              onValueChange={(v) => {
                const res = setOrderPriority(order.id, v as Priority);
                res.ok ? toast.success(res.message) : toast.error(res.message);
              }}
            >
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {order.status === "Created" ? (
              <Button
                onClick={() => {
                  const res = allocateOrder(order.id);
                  res.ok ? toast.success(res.message) : toast.error(res.message);
                }}
              >
                Allocate stock
              </Button>
            ) : null}
          </div>
        }
      />

      <Panel title="Fulfillment Timeline">
        <ol className="grid gap-3 md:grid-cols-7">
          {PIPELINE_STAGES.map((stage, i) => {
            const done = currentRank > i;
            const active = currentRank === i;
            return (
              <li
                key={stage}
                className={cn(
                  "rounded-lg border px-3 py-3 text-xs",
                  done && "border-success/30 bg-success/8 text-success",
                  active && "border-primary/40 bg-primary/10 text-primary",
                  !done && !active && "border-border/70 bg-muted/20 text-muted-foreground",
                )}
              >
                <div className="flex items-center gap-1.5">
                  {done ? <CheckCircle2 className="size-3.5" /> : <span className="size-3.5 rounded-full border border-current" />}
                  <span className="font-medium">{stage}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Line Items" className="xl:col-span-2" bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Picked</TableHead>
                <TableHead className="text-right">Packed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => {
                const product = state.products.find((p) => p.id === it.productId)!;
                return (
                  <TableRow key={it.id}>
                    <TableCell>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </TableCell>
                    <TableCell className="text-right">{it.requestedQty}</TableCell>
                    <TableCell className={cn("text-right", it.allocatedQty < it.requestedQty && "text-warning")}>
                      {it.allocatedQty}
                    </TableCell>
                    <TableCell className="text-right">{it.pickedQty}</TableCell>
                    <TableCell className="text-right">{it.packedQty}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>

        <Panel title="Order Information">
          <dl className="space-y-3 text-sm">
            {[
              ["Customer", customer.name],
              ["Email", customer.email],
              ["Phone", customer.phone],
              ["Order date", dateTime(order.orderDate)],
              ["Promised dispatch", dateTime(order.promisedDispatchDate)],
              ["Total value", currency(order.totalValue)],
              ["Dispatch", dispatch ? `${dispatch.method} · ${dispatch.trackingRef}` : "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {exceptions.length ? (
            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exceptions</p>
              {exceptions.map((e) => (
                <div key={e.id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Pill tone={e.severity === "Critical" ? "danger" : "warning"}>{e.type}</Pill>
                    <span className="text-[11px] text-muted-foreground">{e.status}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{e.description}</p>
                </div>
              ))}
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel title="Order Activity" bodyClassName="p-0">
        {activity.length === 0 ? (
          <div className="p-5"><EmptyState title="No activity recorded yet" /></div>
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-4 px-5 py-3">
                <span className="w-36 shrink-0 text-xs text-muted-foreground">{dateTime(a.timestamp)}</span>
                <div>
                  <p className="text-sm font-medium">{a.action}</p>
                  <p className="text-xs text-muted-foreground">{a.description} — {a.actor}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
