import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useWarehouseState } from "@/lib/store";
import { inventoryRows, kpis } from "@/lib/selectors";
import type { StockStatus } from "@/lib/types";
import { EmptyState, KpiCard, PageHeader, Panel, currency } from "@/components/warehouse/primitives";
import { StockBadge } from "@/components/warehouse/badges";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Nexus Warehouse" },
      {
        name: "description",
        content: "Monitor stock by zone and bin: total, reserved, available, damaged units and reorder thresholds.",
      },
      { property: "og:title", content: "Inventory — Nexus Warehouse" },
      { property: "og:description", content: "Live stock monitoring with low-stock and out-of-stock detection." },
    ],
  }),
  component: InventoryPage,
});

type SortKey = "name" | "available" | "total" | "status";

function InventoryPage() {
  const state = useWarehouseState();
  const k = kpis(state);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<StockStatus | "all">("all");
  const [sort, setSort] = useState<SortKey>("name");

  const categories = useMemo(
    () => Array.from(new Set(state.products.map((p) => p.category))).sort(),
    [state.products],
  );

  const rows = useMemo(() => {
    const statusRank = { "Out of Stock": 0, "Low Stock": 1, Healthy: 2 } as const;
    return inventoryRows(state)
      .filter((r) => (category === "all" ? true : r.product.category === category))
      .filter((r) => (status === "all" ? true : r.status === status))
      .filter((r) =>
        query.trim()
          ? `${r.product.name} ${r.product.sku} ${r.inv.bin}`.toLowerCase().includes(query.trim().toLowerCase())
          : true,
      )
      .sort((a, b) => {
        if (sort === "available") return a.available - b.available;
        if (sort === "total") return b.inv.totalQty - a.inv.totalQty;
        if (sort === "status") return statusRank[a.status] - statusRank[b.status];
        return a.product.name.localeCompare(b.product.name);
      });
  }, [state, query, category, status, sort]);

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" subtitle="Stock monitoring across zones and bin locations." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="SKUs tracked" value={state.products.length} />
        <KpiCard label="Low stock" value={k.lowStock} tone="warning" />
        <KpiCard label="Out of stock" value={k.outOfStock} tone="danger" />
        <KpiCard label="Damaged units" value={k.damagedUnits} tone="danger" hint="Never counted as available" />
      </div>

      <Panel bodyClassName="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search product, SKU or bin…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as StockStatus | "all")}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Stock status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock states</SelectItem>
              <SelectItem value="Healthy">Healthy</SelectItem>
              <SelectItem value="Low Stock">Low Stock</SelectItem>
              <SelectItem value="Out of Stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Product name</SelectItem>
              <SelectItem value="available">Lowest available</SelectItem>
              <SelectItem value="total">Highest total</SelectItem>
              <SelectItem value="status">Risk first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Panel>

      <Panel bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-5"><EmptyState title="No inventory matches your filters" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Damaged</TableHead>
                  <TableHead className="text-right">Reorder @</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.inv.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{r.product.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.product.sku}</TableCell>
                    <TableCell className="text-muted-foreground">{r.product.category}</TableCell>
                    <TableCell className="text-muted-foreground">{r.inv.zone} · {r.inv.bin}</TableCell>
                    <TableCell className="text-right">{r.inv.totalQty}</TableCell>
                    <TableCell className="text-right text-info">{r.inv.reservedQty}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-display font-semibold",
                        r.status === "Out of Stock" && "text-destructive",
                        r.status === "Low Stock" && "text-warning",
                        r.status === "Healthy" && "text-success",
                      )}
                    >
                      {r.available}
                    </TableCell>
                    <TableCell className={cn("text-right", r.inv.damagedQty > 0 && "text-destructive")}>
                      {r.inv.damagedQty}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.product.reorderThreshold}</TableCell>
                    <TableCell><StockBadge status={r.status} /></TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">Details</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>{r.product.name}</DialogTitle></DialogHeader>
                          <dl className="space-y-2 text-sm">
                            {[
                              ["SKU", r.product.sku],
                              ["Category", r.product.category],
                              ["Unit price", currency(r.product.price)],
                              ["Zone / bin", `${r.inv.zone} · ${r.inv.bin}`],
                              ["Total quantity", `${r.inv.totalQty}`],
                              ["Reserved", `${r.inv.reservedQty}`],
                              ["Damaged", `${r.inv.damagedQty}`],
                              ["Available", `${r.available}`],
                              ["Reorder threshold", `${r.product.reorderThreshold}`],
                              ["Stock status", r.status],
                            ].map(([label, value]) => (
                              <div key={label} className="flex justify-between gap-3">
                                <dt className="text-muted-foreground">{label}</dt>
                                <dd className="font-medium">{value}</dd>
                              </div>
                            ))}
                          </dl>
                          <p className="text-xs text-muted-foreground">
                            Available = total − reserved − damaged. Damaged units are never allocatable.
                          </p>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
