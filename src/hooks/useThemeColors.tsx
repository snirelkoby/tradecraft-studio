import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ThemeColors {
  accent: string; // HSL values like "217 91% 60%"
  negative: string;
  positive: string;
  background: string;
}

const PRESETS = {
  blue: '217 91% 60%',
  teal: '174 72% 46%',
  orange: '25 95% 53%',
  gold: '45 93% 47%',
  pink: '330 81% 60%',
  indigo: '243 75% 59%',
  emerald: '160 84% 39%',
  rose: '350 89% 60%',
};

const DEFAULT_COLORS: ThemeColors = {
  accent: '217 91% 60%',
  negative: '270 70% 55%', // purple
  positive: '142 71% 45%',
  background: '220 20% 3%',
};

const STORAGE_KEY = 'edgelab-theme-colors';

interface ThemeColorCtx {
  colors: ThemeColors;
  setColors: (c: Partial<ThemeColors>) => void;
  presets: Record<string, string>;
}

const ThemeColorContext = createContext<ThemeColorCtx>({
  colors: DEFAULT_COLORS,
  setColors: () => {},
  presets: PRESETS,
});

export function ThemeColorProvider({ children }: { children: ReactNode }) {
  const [colors, setColorsState] = useState<ThemeColors>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_COLORS, ...JSON.parse(stored) } : DEFAULT_COLORS;
    } catch {
      return DEFAULT_COLORS;
    }
  });

  const setColors = (partial: Partial<ThemeColors>) => {
    setColorsState(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Apply CSS variables
  useEffect(() => {
    const root = document.documentElement;
    // Accent/primary
    root.style.setProperty('--primary', colors.accent);
    root.style.setProperty('--ring', colors.accent);
    root.style.setProperty('--sidebar-primary', colors.accent);
    root.style.setProperty('--sidebar-ring', colors.accent);
    root.style.setProperty('--chart-blue', colors.accent);
    // Positive/Negative
    root.style.setProperty('--chart-green', colors.positive);
    root.style.setProperty('--success', colors.positive);
    root.style.setProperty('--chart-red', colors.negative);
    // Background (dark mode only)
    const isDark = root.classList.contains('dark');
    if (isDark && colors.background !== DEFAULT_COLORS.background) {
      root.style.setProperty('--background', colors.background);
    }
  }, [colors]);

  return (
    <ThemeColorContext.Provider value={{ colors, setColors, presets: PRESETS }}>
      {children}
    </ThemeColorContext.Provider>
  );
}

export function useThemeColors() {
  return useContext(ThemeColorContext);
}
