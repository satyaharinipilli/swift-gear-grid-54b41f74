import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PackageSearch } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground/80">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneRing: Record<string, string> = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  };
  return (
    <div className="panel group relative overflow-hidden p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon ? <Icon className={cn("size-4 opacity-70", toneRing[tone])} /> : null}
      </div>
      <p className={cn("stat-value mt-2", toneRing[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 px-6 py-12 text-center">
      <PackageSearch className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function ProgressBar({ value, tone = "primary" }: { value: number; tone?: "primary" | "success" | "warning" }) {
  const toneBg = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
  }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all duration-500", toneBg)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const dateOnly = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return `${mins <= 0 ? "in " : ""}${Math.abs(mins)}m${mins > 0 ? " ago" : ""}`;
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 48) return `${hrs <= 0 ? "in " : ""}${Math.abs(hrs)}h${hrs > 0 ? " ago" : ""}`;
  const days = Math.round(hrs / 24);
  return `${days <= 0 ? "in " : ""}${Math.abs(days)}d${days > 0 ? " ago" : ""}`;
}
