export const CLASSE_OPTIONS = [
  { value: "adulto", label: "Adulto" },
  { value: "infantil", label: "Infantil" },
] as const;

export const FAIXA_ORDER_ADULTO = ["branca", "azul", "roxa", "marrom", "preta"];
export const FAIXA_ORDER_INFANTIL = ["branca", "cinza", "amarela", "laranja", "verde", "azul", "roxa", "marrom", "preta"];

export function getFaixaOrder(classe: string) {
  return classe === "infantil" ? FAIXA_ORDER_INFANTIL : FAIXA_ORDER_ADULTO;
}

export function getNextFaixa(faixa: string, classe: string): string | null {
  const order = getFaixaOrder(classe);
  const idx = order.indexOf(faixa);
  if (idx < 0 || idx >= order.length - 1) return null;
  return order[idx + 1];
}
