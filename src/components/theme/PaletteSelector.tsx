import { cn } from "@/lib/utils";
import { paletteOptions, useThemeSettings } from "./ThemeProvider";

export const PaletteSelector = () => {
  const { palette, setPalette } = useThemeSettings();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {paletteOptions.map((option) => {
        const active = palette === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setPalette(option.id)}
            className={cn(
              "group rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              active
                ? "border-primary/45 bg-primary/10 shadow-[0_24px_48px_-30px_hsl(var(--shadow-color))]"
                : "border-border/70 bg-card/65 hover:border-primary/20 hover:bg-accent/30",
            )}
            aria-pressed={active}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{option.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
              </div>
              {active && (
                <span className="rounded-full border border-primary/35 bg-primary/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                  Ativa
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {option.colors.map((color) => (
                <span
                  key={color}
                  className="h-9 w-9 rounded-full border border-white/10 shadow-inner"
                  style={{ background: color }}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
};
