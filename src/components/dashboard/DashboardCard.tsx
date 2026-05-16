import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  description?: string;
  accent?: string;
  trendLabel?: string;
  className?: string;
}

const DashboardCard = ({
  icon: Icon,
  label,
  value,
  description,
  accent,
  trendLabel,
  className,
}: DashboardCardProps) => {
  return (
    <div className={cn("premium-card group h-full p-5 sm:p-6", className)}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_18px_40px_-26px_hsl(var(--shadow-color))]">
          <Icon className="h-5 w-5" />
        </div>
        {trendLabel ? (
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400">
            {trendLabel}
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          {label}
        </p>
        <div className="flex items-end justify-between gap-3">
          <span className="font-heading text-3xl uppercase leading-none tracking-[0.08em] text-foreground">
            {value}
          </span>
          <span
            className="h-1.5 w-20 rounded-full opacity-75"
            style={{
              background:
                accent ||
                "linear-gradient(90deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.9), hsl(var(--primary-glow) / 0.9))",
            }}
          />
        </div>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
};

export default DashboardCard;
