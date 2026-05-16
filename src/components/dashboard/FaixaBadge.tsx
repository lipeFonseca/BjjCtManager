import { cn } from "@/lib/utils";

interface FaixaBadgeProps {
  faixa: string | null;
  grau?: number;
  size?: "sm" | "md";
  className?: string;
}

const getFaixaColor = (faixa: string | null) => {
  const colors: Record<string, string> = {
    branca: "bg-white text-black border border-border",
    cinza: "bg-gray-400 text-black",
    amarela: "bg-yellow-400 text-black",
    laranja: "bg-orange-500 text-white",
    verde: "bg-green-600 text-white",
    azul: "bg-blue-600 text-white",
    roxa: "bg-purple-600 text-white",
    marrom: "bg-amber-800 text-white",
    preta: "bg-black text-white border border-white/20",
  };
  return colors[faixa || "branca"] || "bg-secondary text-foreground";
};

const FaixaBadge = ({ faixa, grau = 0, size = "md", className }: FaixaBadgeProps) => {
  const displayFaixa = faixa || "branca";
  const sizeClasses = size === "sm" ? "h-4 px-2 min-w-12" : "h-5 px-2.5 min-w-14";
  const stripeWidth = size === "sm" ? "w-[3px]" : "w-1";
  const stripeGap = size === "sm" ? "gap-[2px]" : "gap-[3px]";
  const normalizedGrau = Math.max(0, Math.min(grau, 10));

  return (
    <span
      className={cn(
        "rounded inline-flex items-center relative overflow-hidden",
        sizeClasses,
        getFaixaColor(displayFaixa),
        className
      )}
    >
      {normalizedGrau > 0 && (
        <span className={cn("inline-flex h-full items-stretch", stripeGap)}>
          {Array.from({ length: normalizedGrau }).map((_, i) => (
            <span key={i} className={cn(stripeWidth, "h-full bg-white")} />
          ))}
        </span>
      )}
    </span>
  );
};

export { FaixaBadge, getFaixaColor };
export default FaixaBadge;
