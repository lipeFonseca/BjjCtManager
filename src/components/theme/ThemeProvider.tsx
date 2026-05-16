import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "dark" | "light";
export type ThemePalette = "red-combat" | "gold-premium" | "cyber-blue" | "emerald-pro";

export const THEME_STORAGE_KEY = "bjj-manager-theme";
export const PALETTE_STORAGE_KEY = "bjj-manager-palette";

export const paletteOptions: Array<{
  id: ThemePalette;
  name: string;
  description: string;
  colors: [string, string, string];
}> = [
  {
    id: "red-combat",
    name: "Red Combat",
    description: "Preto, vermelho e grafite para uma estética de combate premium.",
    colors: ["#ef4444", "#09090b", "#3f3f46"],
  },
  {
    id: "gold-premium",
    name: "Gold Premium",
    description: "Preto, dourado e branco gelo para um painel mais executivo.",
    colors: ["#d4a938", "#111111", "#f5f5f4"],
  },
  {
    id: "cyber-blue",
    name: "Cyber Blue",
    description: "Azul elétrico e violeta sobre base escura refinada.",
    colors: ["#22c7ff", "#7c3aed", "#111827"],
  },
  {
    id: "emerald-pro",
    name: "Emerald Pro",
    description: "Verde esmeralda e carvão com leitura limpa e técnica.",
    colors: ["#10b981", "#101716", "#1f2937"],
  },
];

interface ThemeSettingsContextValue {
  theme: ThemeMode;
  palette: ThemePalette;
  setTheme: (theme: ThemeMode) => void;
  setPalette: (palette: ThemePalette) => void;
  toggleTheme: () => void;
}

const ThemeSettingsContext = createContext<ThemeSettingsContextValue | null>(null);

const applyThemeSettings = (theme: ThemeMode, palette: ThemePalette) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.dataset.palette = palette;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [palette, setPaletteState] = useState<ThemePalette>("red-combat");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    const storedPalette = window.localStorage.getItem(PALETTE_STORAGE_KEY) as ThemePalette | null;

    const nextTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
    const nextPalette = paletteOptions.some((option) => option.id === storedPalette)
      ? (storedPalette as ThemePalette)
      : "red-combat";

    setThemeState(nextTheme);
    setPaletteState(nextPalette);
    applyThemeSettings(nextTheme, nextPalette);
  }, []);

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }
    applyThemeSettings(nextTheme, palette);
  };

  const setPalette = (nextPalette: ThemePalette) => {
    setPaletteState(nextPalette);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, nextPalette);
    }
    applyThemeSettings(theme, nextPalette);
  };

  const value = useMemo<ThemeSettingsContextValue>(
    () => ({
      theme,
      palette,
      setTheme,
      setPalette,
      toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    }),
    [palette, theme],
  );

  return <ThemeSettingsContext.Provider value={value}>{children}</ThemeSettingsContext.Provider>;
};

export const useThemeSettings = () => {
  const context = useContext(ThemeSettingsContext);
  if (!context) {
    throw new Error("useThemeSettings must be used within ThemeProvider");
  }
  return context;
};
