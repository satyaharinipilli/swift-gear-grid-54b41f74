import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { useWarehouseState, allocateOrder, createOrder } from "@/lib/store";
import { orderRows } from "@/lib/selectors";
import { ORDER_STATUSES, PRIORITIES, type OrderStatus, type Priority } from "@/lib/types";
import { EmptyState, PageHeader, Panel, ProgressBar, currency, dateOnly } from "@/components/warehouse/primitives";
import { OrderStatusBadge, PriorityBadge } from "@/components/warehouse/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/orders/")({
  head: () => ({
    meta: [
      { title: "Orders — Nexus Warehouse" },
      {
        name: "description",
        content: "Manage fulfillment orders: priority, status, allocation and progress across the warehouse.",
      },
      { property: "og:title", content: "Orders — Nexus Warehouse" },
      { property: "og:description", content: "Order management and stock allocation for warehouse fulfillment." },
    ],
  }),
  component: OrdersPage,
});

type SortKey = "date" | "priority" | "value" | "promised";

function OrdersPage() {
  const state = useWarehouseState();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [sort, setSort] = useState<SortKey>("date");

  const rows = useMemo(() => {
    const priorityRank = { Urgent: 0, High: 1, Normal: 2, Low: 3 } as const;
    return orderRows(state)
      .filter((r) => (status === "all" ? true : r.order.status === status))
      .filter((r) => (priority === "all" ? true : r.order.priority === priority))
      .filter((r) =>
        query.trim()
          ? `${r.order.orderNumber} ${r.customer.name}`.toLowerCase().includes(query.trim().toLowerCase())
          : true,
      )
      .sort((a, b) => {
        if (sort === "priority") return priorityRank[a.order.priority] - priorityRank[b.order.priority];
        if (sort === "value") return b.order.totalValue - a.order.totalValue;
        if (sort === "promised")
          return a.order.promisedDispatchDate.localeCompare(b.order.promisedDispatchDate);
        return b.order.orderDate.localeCompare(a.order.orderDate);
      });
  }, [state, query, status, priority, sort]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        subtitle="Order management, prioritization and stock allocation."
        actions={<NewOrderDialog />}
      />

      <Panel bodyClassName="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order number or customer…"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus | "all")}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority | "all")}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Newest first</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="value">Order value</SelectItem>
              <SelectItem value="promised">Promised dispatch</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Panel>

      <Panel bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No orders match your filters" description="Adjust search, status or priority." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Ordered</TableHead>
                  <TableHead>Promised</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40">Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const overdue =
                    new Date(r.order.promisedDispatchDate).getTime() < Date.now() &&
                    !["Dispatched", "Completed"].includes(r.order.status);
                  return (
                    <TableRow key={r.order.id} className="hover:bg-muted/30">
                      <TableCell>
                        <Link
                          to="/orders/$orderId"
                          params={{ orderId: r.order.id }}
                          className="font-medium hover:text-primary"
                        >
                          {r.order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.customer.name}</TableCell>
                      <TableCell className="text-muted-foreground">{dateOnly(r.order.orderDate)}</TableCell>
                      <TableCell className={overdue ? "text-destructive" : "text-muted-foreground"}>
                        {dateOnly(r.order.promisedDispatchDate)}
                      </TableCell>
                      <TableCell><PriorityBadge priority={r.order.priority} /></TableCell>
                      <TableCell className="text-right font-display">{currency(r.order.totalValue)}</TableCell>
                      <TableCell><OrderStatusBadge status={r.order.status} /></TableCell>
                      <TableCell>
                        <ProgressBar value={r.progress} tone={r.progress === 100 ? "success" : "primary"} />
                        <span className="mt-1 block text-[11px] text-muted-foreground">{r.progress}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.order.status === "Created" ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              const res = allocateOrder(r.order.id);
                              res.ok ? toast.success(res.message) : toast.error(res.message);
                            }}
                          >
                            Allocate
                          </Button>
                        ) : (
                          <Link to="/orders/$orderId" params={{ orderId: r.order.id }}>
                            <Button size="sm" variant="ghost">View</Button>
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function NewOrderDialog() {
  const state = useWarehouseState();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [promised, setPromised] = useState(
    new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10),
  );
  const [lines, setLines] = useState([{ productId: "", quantity: 1 }]);

  const submit = () => {
    const res = createOrder({ customerId, priority, promisedDispatchDate: promised, lines });
    if (res.ok) {
      toast.success(res.message);
      setOpen(false);
      setLines([{ productId: "", quantity: 1 }]);
      setCustomerId("");
    } else {
      toast.error(res.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> New order</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create order</DialogTitle>
          <DialogDescription>Orders start in the Created stage and await stock allocation.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {state.customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Promised dispatch date</Label>
            <Input type="date" value={promised} onChange={(e) => setPromised(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Line items</Label>
            {lines.map((line, i) => (
              <div key={i} className="flex gap-2">
                <Select
                  value={line.productId}
                  onValueChange={(v) =>
                    setLines((ls) => ls.map((l, k) => (k === i ? { ...l, productId: v } : l)))
                  }
                >
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {state.products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.sku} · {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  className="w-24"
                  value={line.quantity}
                  onChange={(e) =>
                    setLines((ls) =>
                      ls.map((l, k) => (k === i ? { ...l, quantity: Number(e.target.value) } : l)),
                    )
                  }
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLines((ls) => [...ls, { productId: "", quantity: 1 }])}
            >
              Add line
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>Create order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
