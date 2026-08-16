import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  PackageCheck,
  ShieldAlert,
  Truck,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hydrateFromStorage, resetDemoData, setRole, useWarehouse } from "@/lib/store";
import type { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NAV: Array<{ group: string; items: Array<{ to: string; label: string; icon: typeof Boxes }> }> = [
  { group: "Overview", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    group: "Operations",
    items: [
      { to: "/orders", label: "Orders", icon: ClipboardList },
      { to: "/inventory", label: "Inventory", icon: Boxes },
      { to: "/picking", label: "Picking & Packing", icon: PackageCheck },
      { to: "/dispatch", label: "Quality & Dispatch", icon: Truck },
    ],
  },
  {
    group: "Control",
    items: [
      { to: "/exceptions", label: "Exceptions", icon: ShieldAlert },
      { to: "/activity", label: "Activity Log", icon: Activity },
    ],
  },
  { group: "Intelligence", items: [{ to: "/analytics", label: "Analytics", icon: BarChart3 }] },
];

const ROLES: Role[] = ["Warehouse Manager", "Warehouse Worker"];

export function AppShell({ children }: { children: ReactNode }) {
  const role = useWarehouse((s) => s.role);
  const openExceptions = useWarehouse((s) => s.exceptions.filter((e) => e.status !== "Resolved").length);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    hydrateFromStorage();
  }, []);

  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Warehouse className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold tracking-wide">NEXUS WAREHOUSE</p>
            <p className="text-[11px] text-muted-foreground">Operations Command</p>
          </div>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV.map((section) => (
            <div key={section.group}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                {section.group}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--sidebar-primary)]"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className={cn("size-4", active && "text-primary")} />
                      <span className="flex-1">{item.label}</span>
                      {item.to === "/exceptions" && openExceptions > 0 ? (
                        <span className="rounded-full bg-destructive/20 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                          {openExceptions}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">Demo role</p>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
                  role === r
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.replace("Warehouse ", "")}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full text-xs text-muted-foreground"
            onClick={() => {
              resetDemoData();
              toast.success("Demo data reset to seeded warehouse state.");
            }}
          >
            Reset demo data
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <Warehouse className="size-5 text-primary" />
          <span className="font-display text-sm font-semibold">NEXUS WAREHOUSE</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-background/70 px-3 py-2 lg:hidden">
          {NAV.flatMap((s) => s.items).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              activeProps={{ className: "bg-sidebar-accent text-foreground" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
