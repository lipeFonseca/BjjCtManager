import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  icon: LucideIcon;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const ChartCard = ({ title, icon: Icon, subtitle, action, children, className }: ChartCardProps) => {
  return (
    <section className={cn("premium-card p-5 sm:p-6", className)}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="font-heading text-lg uppercase tracking-[0.14em] text-foreground">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {action ? <div className="sm:ml-4">{action}</div> : null}
      </div>
      {children}
    </section>
  );
};

export default ChartCard;
