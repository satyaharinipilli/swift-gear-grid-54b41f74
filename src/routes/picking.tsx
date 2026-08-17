import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  completePackingTask,
  completePickingTask,
  recordPickItem,
  startPackingTask,
  startPickingTask,
  updatePackageCount,
  useWarehouseState,
} from "@/lib/store";
import type { PickingTask } from "@/lib/types";
import { EmptyState, PageHeader, Panel } from "@/components/warehouse/primitives";
import { PickItemBadge, PriorityBadge, TaskBadge } from "@/components/warehouse/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/picking")({
  head: () => ({
    meta: [
      { title: "Picking & Packing — Nexus Warehouse" },
      {
        name: "description",
        content: "Run picking tasks, record missing or damaged units, and pack orders into packages for QC.",
      },
      { property: "og:title", content: "Picking & Packing — Nexus Warehouse" },
      { property: "og:description", content: "Floor execution for picking tasks and packing stations." },
    ],
  }),
  component: PickPackPage,
});

function PickPackPage() {
  const state = useWarehouseState();

  return (
    <div className="space-y-6">
      <PageHeader title="Picking & Packing" subtitle="Floor execution for allocated orders." />
      <Tabs defaultValue="picking">
        <TabsList>
          <TabsTrigger value="picking">Picking ({state.pickingTasks.filter((t) => t.status !== "Completed").length} open)</TabsTrigger>
          <TabsTrigger value="packing">Packing ({state.packingTasks.filter((t) => t.status !== "Completed").length} open)</TabsTrigger>
        </TabsList>
        <TabsContent value="picking" className="mt-4">
          <PickingSection />
        </TabsContent>
        <TabsContent value="packing" className="mt-4">
          <PackingSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PickingSection() {
  const state = useWarehouseState();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const tasks = [...state.pickingTasks].sort(
    (a, b) => Number(a.status === "Completed") - Number(b.status === "Completed"),
  );
  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;

  return (
    <>
      <Panel bodyClassName="p-0">
        {tasks.length === 0 ? (
          <div className="p-5"><EmptyState title="No picking tasks" description="Allocate an order to generate a picking task." /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => {
                  const order = state.orders.find((o) => o.id === t.orderId)!;
                  const worker = state.workers.find((w) => w.id === t.workerId);
                  const done = t.items.filter((i) => i.status !== "Pending").length;
                  return (
                    <TableRow key={t.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{t.taskCode}</TableCell>
                      <TableCell>{order?.orderNumber}</TableCell>
                      <TableCell>{order ? <PriorityBadge priority={order.priority} /> : null}</TableCell>
                      <TableCell className="text-muted-foreground">{worker?.name ?? "Unassigned"}</TableCell>
                      <TableCell className="text-muted-foreground">{t.zone}</TableCell>
                      <TableCell className="text-muted-foreground">{done}/{t.items.length}</TableCell>
                      <TableCell><TaskBadge status={t.status} /></TableCell>
                      <TableCell className="space-x-2 text-right">
                        {t.status === "Pending" ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              const res = startPickingTask(t.id);
                              res.ok ? toast.success(res.message) : toast.error(res.message);
                            }}
                          >
                            Start task
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => setOpenTaskId(t.id)}>
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
      <PickTaskDialog task={openTask} onClose={() => setOpenTaskId(null)} />
    </>
  );
}

function PickTaskDialog({ task, onClose }: { task: PickingTask | null; onClose: () => void }) {
  const state = useWarehouseState();
  const [drafts, setDrafts] = useState<Record<string, { qty: string; notes: string }>>({});

  if (!task) return null;
  const order = state.orders.find((o) => o.id === task.orderId);

  const draftFor = (id: string, required: number) =>
    drafts[id] ?? { qty: String(required), notes: "" };

  const record = (itemId: string, status: "Picked" | "Partial" | "Missing" | "Damaged", required: number) => {
    const d = draftFor(itemId, required);
    const res = recordPickItem(task.id, itemId, {
      status,
      quantity: status === "Picked" ? required : Number(d.qty || 0),
      notes: d.notes || undefined,
    });
    res.ok ? toast.success(res.message) : toast.error(res.message);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task.taskCode} · {order?.orderNumber}</DialogTitle>
          <DialogDescription>
            Record every line as picked, partial, missing or damaged. Missing and damaged units raise exceptions
            and adjust inventory automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {task.items.map((line) => {
            const product = state.products.find((p) => p.id === line.productId)!;
            const d = draftFor(line.id, line.requiredQty);
            return (
              <div key={line.id} className="rounded-lg border border-border/70 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.sku} · {line.location} · required {line.requiredQty}
                    </p>
                  </div>
                  <PickItemBadge status={line.status} />
                </div>
                {task.status === "In Progress" ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-[7rem_1fr]">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        min={0}
                        max={line.requiredQty}
                        value={d.qty}
                        onChange={(e) =>
                          setDrafts((s) => ({ ...s, [line.id]: { ...d, qty: e.target.value } }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Notes</Label>
                      <Textarea
                        rows={1}
                        value={d.notes}
                        placeholder="Optional note for this line"
                        onChange={(e) =>
                          setDrafts((s) => ({ ...s, [line.id]: { ...d, notes: e.target.value } }))
                        }
                      />
                    </div>
                    <div className="sm:col-span-2 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => record(line.id, "Picked", line.requiredQty)}>Mark picked</Button>
                      <Button size="sm" variant="outline" onClick={() => record(line.id, "Partial", line.requiredQty)}>
                        Record partial
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => record(line.id, "Damaged", line.requiredQty)}>
                        Damaged
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => record(line.id, "Missing", line.requiredQty)}>
                        Missing
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Picked {line.pickedQty}/{line.requiredQty}
                    {line.notes ? ` · ${line.notes}` : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {task.status === "In Progress" ? (
            <Button
              onClick={() => {
                const res = completePickingTask(task.id);
                if (res.ok) {
                  toast.success(res.message);
                  onClose();
                } else toast.error(res.message);
              }}
            >
              Complete picking
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PackingSection() {
  const state = useWarehouseState();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const tasks = [...state.packingTasks].sort(
    (a, b) => Number(a.status === "Completed") - Number(b.status === "Completed"),
  );

  if (!tasks.length) {
    return (
      <Panel>
        <EmptyState title="No packing tasks" description="Complete a picking task to create packing work." />
      </Panel>
    );
  }

  return (
    <Panel bodyClassName="p-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead>Station</TableHead>
              <TableHead className="w-32">Packages</TableHead>
              <TableHead className="w-56">Notes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((t) => {
              const order = state.orders.find((o) => o.id === t.orderId);
              const worker = state.workers.find((w) => w.id === t.workerId);
              const editable = t.status === "In Progress";
              return (
                <TableRow key={t.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{t.taskCode}</TableCell>
                  <TableCell>{order?.orderNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{worker?.name ?? "Unassigned"}</TableCell>
                  <TableCell className="text-muted-foreground">{t.station}</TableCell>
                  <TableCell>
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        value={t.packageCount}
                        className="h-8 w-20"
                        onChange={(e) => {
                          const res = updatePackageCount(t.id, Number(e.target.value));
                          if (!res.ok) toast.error(res.message);
                        }}
                      />
                    ) : (
                      <span className="text-muted-foreground">{t.packageCount}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editable ? (
                      <Input
                        className="h-8"
                        placeholder="Packing note"
                        value={notes[t.id] ?? ""}
                        onChange={(e) => setNotes((s) => ({ ...s, [t.id]: e.target.value }))}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t.notes ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell><TaskBadge status={t.status} /></TableCell>
                  <TableCell className="space-x-2 text-right">
                    {t.status === "Pending" ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          const res = startPackingTask(t.id);
                          res.ok ? toast.success(res.message) : toast.error(res.message);
                        }}
                      >
                        Start packing
                      </Button>
                    ) : null}
                    {editable ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          const res = completePackingTask(t.id, notes[t.id]);
                          res.ok ? toast.success(res.message) : toast.error(res.message);
                        }}
                      >
                        Mark packed
                      </Button>
                    ) : null}
                    {t.status === "Completed" ? (
                      <span className="text-xs text-muted-foreground">Sent to QC</span>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}
