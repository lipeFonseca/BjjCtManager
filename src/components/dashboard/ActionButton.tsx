import { forwardRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActionButtonProps extends ButtonProps {
  emphasis?: "primary" | "secondary" | "ghost" | "danger";
}

const emphasisClasses: Record<NonNullable<ActionButtonProps["emphasis"]>, string> = {
  primary:
    "border border-primary/30 bg-primary text-primary-foreground shadow-[0_18px_42px_-24px_hsl(var(--shadow-color))] hover:bg-primary/90 hover:-translate-y-0.5",
  secondary:
    "border border-border/70 bg-card/85 text-foreground hover:bg-accent hover:-translate-y-0.5",
  ghost:
    "border border-border/40 bg-transparent text-muted-foreground hover:border-primary/20 hover:bg-primary/8 hover:text-foreground",
  danger:
    "border border-destructive/35 bg-destructive/12 text-destructive hover:bg-destructive/18 hover:-translate-y-0.5",
};

const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ className, emphasis = "secondary", ...props }, ref) => (
    <Button
      ref={ref}
      className={cn(
        "rounded-2xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/40",
        emphasisClasses[emphasis],
        className,
      )}
      {...props}
    />
  ),
);

ActionButton.displayName = "ActionButton";

export default ActionButton;
