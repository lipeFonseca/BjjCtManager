import { Moon, SunMedium } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeSettings } from "./ThemeProvider";

export const ThemeToggle = () => {
  const { theme, setTheme } = useThemeSettings();

  return (
    <div
      className="inline-flex rounded-2xl border border-border/70 bg-background/60 p-1 shadow-[0_18px_40px_-28px_hsl(var(--shadow-color))]"
      role="tablist"
      aria-label="Seleção de tema"
    >
      {[
        { id: "dark" as const, label: "Escuro", icon: Moon },
        { id: "light" as const, label: "Claro", icon: SunMedium },
      ].map((option) => {
        const Icon = option.icon;
        const active = theme === option.id;

        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTheme(option.id)}
            className={cn(
              "inline-flex min-w-[112px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              active
                ? "bg-primary text-primary-foreground shadow-[0_16px_36px_-22px_hsl(var(--shadow-color))]"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
