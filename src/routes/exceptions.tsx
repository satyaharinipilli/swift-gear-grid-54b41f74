import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { updateException, useWarehouseState } from "@/lib/store";
import type { ExceptionSeverity, ExceptionStatus, ExceptionType, WarehouseException } from "@/lib/types";
import { EmptyState, KpiCard, PageHeader, Panel, dateTime } from "@/components/warehouse/primitives";
import { ExceptionStatusBadge, SeverityBadge } from "@/components/warehouse/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TYPES: ExceptionType[] = [
  "Damaged Item",
  "Missing Item",
  "Quantity Mismatch",
  "Stock Mismatch",
  "Quality Check Failure",
  "Delayed Fulfillment",
];

export const Route = createFileRoute("/exceptions")({
  head: () => ({
    meta: [
      { title: "Exceptions — Nexus Warehouse" },
      {
        name: "description",
        content: "Triage damaged, missing, mismatched and delayed fulfillment exceptions across the warehouse.",
      },
      { property: "og:title", content: "Exceptions — Nexus Warehouse" },
      { property: "og:description", content: "Warehouse exception management with severity and resolution tracking." },
    ],
  }),
  component: ExceptionsPage,
});

function ExceptionsPage() {
  const state = useWarehouseState();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ExceptionType | "all">("all");
  const [severity, setSeverity] = useState<ExceptionSeverity | "all">("all");
  const [status, setStatus] = useState<ExceptionStatus | "all">("all");
  const [selected, setSelected] = useState<WarehouseException | null>(null);

  const rows = useMemo(
    () =>
      state.exceptions
        .filter((e) => (type === "all" ? true : e.type === type))
        .filter((e) => (severity === "all" ? true : e.severity === severity))
        .filter((e) => (status === "all" ? true : e.status === status))
        .filter((e) =>
          query.trim() ? `${e.code} ${e.description}`.toLowerCase().includes(query.trim().toLowerCase()) : true,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.exceptions, query, type, severity, status],
  );

  const open = state.exceptions.filter((e) => e.status === "Open").length;
  const investigating = state.exceptions.filter((e) => e.status === "Investigating").length;
  const critical = state.exceptions.filter((e) => e.severity === "Critical" && e.status !== "Resolved").length;
  const resolved = state.exceptions.filter((e) => e.status === "Resolved").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Exceptions" subtitle="Operational issues raised across allocation, picking, QC and dispatch." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Open" value={open} tone="danger" />
        <KpiCard label="Investigating" value={investigating} tone="warning" />
        <KpiCard label="Critical unresolved" value={critical} tone="danger" />
        <KpiCard label="Resolved" value={resolved} tone="success" />
      </div>

      <Panel bodyClassName="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search code or description…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Select value={type} onValueChange={(v) => setType(v as ExceptionType | "all")}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={(v) => setSeverity(v as ExceptionSeverity | "all")}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as ExceptionStatus | "all")}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="Investigating">Investigating</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Panel>

      <Panel bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-5"><EmptyState title="No exceptions match your filters" description="The floor is running clean." /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Raised</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => {
                  const order = state.orders.find((o) => o.id === e.orderId);
                  return (
                    <TableRow key={e.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">{e.code}</TableCell>
                      <TableCell className="font-medium">{e.type}</TableCell>
                      <TableCell><SeverityBadge severity={e.severity} /></TableCell>
                      <TableCell className="text-muted-foreground">{order?.orderNumber ?? "—"}</TableCell>
                      <TableCell className="max-w-md truncate text-muted-foreground">{e.description}</TableCell>
                      <TableCell className="text-muted-foreground">{dateTime(e.createdAt)}</TableCell>
                      <TableCell><ExceptionStatusBadge status={e.status} /></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelected(e)}>Manage</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <ExceptionDialog exception={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ExceptionDialog({ exception, onClose }: { exception: WarehouseException | null; onClose: () => void }) {
  const [status, setStatus] = useState<ExceptionStatus>(exception?.status ?? "Open");
  const [notes, setNotes] = useState(exception?.resolutionNotes ?? "");

  if (!exception) return null;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{exception.code} · {exception.type}</DialogTitle>
          <DialogDescription>{exception.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={exception.severity} />
            <ExceptionStatusBadge status={exception.status} />
            <span className="text-xs text-muted-foreground">Raised {dateTime(exception.createdAt)}</span>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ExceptionStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Investigating">Investigating</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Resolution notes</Label>
            <Textarea
              rows={3}
              value={notes}
              placeholder="Required when resolving an exception"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              const res = updateException(exception.id, { status, resolutionNotes: notes });
              if (res.ok) {
                toast.success(res.message);
                onClose();
              } else toast.error(res.message);
            }}
          >
            Save update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
