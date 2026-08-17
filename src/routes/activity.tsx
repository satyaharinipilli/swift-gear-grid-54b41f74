import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useWarehouseState } from "@/lib/store";
import { EmptyState, PageHeader, Panel, dateTime } from "@/components/warehouse/primitives";
import { Pill } from "@/components/warehouse/badges";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log — Nexus Warehouse" },
      {
        name: "description",
        content: "Chronological audit trail of allocations, picks, packs, quality checks, exceptions and dispatches.",
      },
      { property: "og:title", content: "Activity Log — Nexus Warehouse" },
      { property: "og:description", content: "Full warehouse audit trail with actor, action and entity detail." },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const state = useWarehouseState();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");

  const actions = useMemo(
    () => Array.from(new Set(state.activity.map((a) => a.action))).sort(),
    [state.activity],
  );

  const rows = useMemo(
    () =>
      state.activity
        .filter((a) => (action === "all" ? true : a.action === action))
        .filter((a) =>
          query.trim()
            ? `${a.entity} ${a.description} ${a.actor}`.toLowerCase().includes(query.trim().toLowerCase())
            : true,
        )
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [state.activity, query, action],
  );

  const tone = (a: string) =>
    a.includes("Damaged") || a.includes("Missing") || a.includes("Failed")
      ? "danger"
      : a.includes("Dispatched") || a.includes("Passed") || a.includes("Completed") || a.includes("Resolved")
        ? "success"
        : a.includes("Allocat") || a.includes("Created")
          ? "info"
          : "primary";

  return (
    <div className="space-y-6">
      <PageHeader title="Activity Log" subtitle={`${state.activity.length} recorded warehouse events.`} />

      <Panel bodyClassName="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search entity, actor or description…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </Panel>

      <Panel bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-5"><EmptyState title="No activity matches your filters" /></div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.slice(0, 200).map((a) => (
              <li key={a.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-40 shrink-0 text-xs text-muted-foreground">{dateTime(a.timestamp)}</span>
                <Pill tone={tone(a.action) as "danger" | "success" | "info" | "primary"}>{a.action}</Pill>
                <span className="w-24 shrink-0 text-xs font-medium">{a.entity}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{a.description}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{a.actor}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
