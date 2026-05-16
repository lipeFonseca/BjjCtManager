import { cn } from "@/lib/utils";

interface HeroPanelStat {
  label: string;
  value: string | number;
}

interface HeroPanelProps {
  kicker: string;
  title: string;
  subtitle?: string;
  description?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  bannerPosition?: string;
  logoSize?: number;
  stats?: HeroPanelStat[];
  actions?: React.ReactNode;
  className?: string;
  titleStyle?: React.CSSProperties;
  subtitleStyle?: React.CSSProperties;
}

const HeroPanel = ({
  kicker,
  title,
  subtitle,
  description,
  logoUrl,
  bannerUrl,
  bannerPosition = "50",
  logoSize = 84,
  stats = [],
  actions,
  className,
  titleStyle,
  subtitleStyle,
}: HeroPanelProps) => {
  return (
    <section
      className={cn("hero-panel relative overflow-hidden p-6 sm:p-8", className)}
      style={
        bannerUrl
          ? {
              backgroundImage: `linear-gradient(135deg, hsl(var(--background) / 0.9), hsl(var(--background) / 0.72)), url(${bannerUrl})`,
              backgroundSize: "cover",
              backgroundPosition: `center ${bannerPosition}%`,
            }
          : undefined
      }
    >
      <div className="hero-panel-pattern" />
      <div className="relative z-10 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {logoUrl ? (
              <div className="hero-panel-logo">
                <img
                  src={logoUrl}
                  alt={title}
                  className="object-contain"
                  style={{ height: `${logoSize}px`, width: `${logoSize}px` }}
                />
              </div>
            ) : null}

            <div className="max-w-3xl">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-primary/80">{kicker}</p>
              <h1 className="font-heading text-4xl uppercase tracking-[0.16em] text-foreground sm:text-5xl" style={titleStyle}>
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-2 text-base text-muted-foreground sm:text-lg" style={subtitleStyle}>
                  {subtitle}
                </p>
              ) : null}
              {description ? <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p> : null}
            </div>
          </div>

          {stats.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="hero-panel-stat">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{stat.label}</span>
                  <span className="font-heading text-2xl uppercase tracking-[0.08em] text-foreground">{stat.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {actions ? (
          <div className="relative z-10 -mx-1 flex w-[calc(100%+0.5rem)] flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 xl:mx-0 xl:w-auto xl:justify-end xl:overflow-visible xl:px-0">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default HeroPanel;
