import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ThemeColors {
  accent: string;
  negative: string;
  positive: string;
  background: string;
  cardBackground: string;
  foreground: string;
  // Light mode overrides
  lightBackground: string;
  lightCard: string;
  lightForeground: string;
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

const DARK_BG_PRESETS: Record<string, { bg: string; card: string; fg: string }> = {
  'Default Dark': { bg: '220 20% 3%', card: '220 18% 6%', fg: '210 40% 96%' },
  'Midnight Blue': { bg: '222 47% 5%', card: '222 40% 8%', fg: '213 31% 91%' },
  'Charcoal': { bg: '0 0% 7%', card: '0 0% 10%', fg: '0 0% 95%' },
  'Deep Navy': { bg: '230 35% 6%', card: '230 30% 9%', fg: '220 30% 92%' },
  'Warm Dark': { bg: '20 14% 5%', card: '20 12% 8%', fg: '30 20% 94%' },
  'Dark Teal': { bg: '180 20% 4%', card: '180 16% 7%', fg: '170 20% 94%' },
};

const LIGHT_BG_PRESETS: Record<string, { bg: string; card: string; fg: string }> = {
  'Default Light': { bg: '0 0% 100%', card: '0 0% 98%', fg: '220 20% 10%' },
  'Warm White': { bg: '40 33% 97%', card: '40 30% 95%', fg: '30 20% 12%' },
  'Cool Gray': { bg: '220 14% 96%', card: '220 14% 93%', fg: '220 20% 10%' },
  'Soft Blue': { bg: '210 40% 97%', card: '210 35% 95%', fg: '215 25% 12%' },
  'Cream': { bg: '45 40% 96%', card: '45 35% 94%', fg: '40 15% 12%' },
  'Mint': { bg: '150 20% 97%', card: '150 18% 95%', fg: '160 15% 10%' },
};

const DEFAULT_COLORS: ThemeColors = {
  accent: '217 91% 60%',
  negative: '270 70% 55%',
  positive: '142 71% 45%',
  background: '220 20% 3%',
  cardBackground: '220 18% 6%',
  foreground: '210 40% 96%',
  lightBackground: '0 0% 100%',
  lightCard: '0 0% 98%',
  lightForeground: '220 20% 10%',
};

const STORAGE_KEY = 'edgelab-theme-colors';

interface ThemeColorCtx {
  colors: ThemeColors;
  setColors: (c: Partial<ThemeColors>) => void;
  presets: Record<string, string>;
  darkBgPresets: typeof DARK_BG_PRESETS;
  lightBgPresets: typeof LIGHT_BG_PRESETS;
}

const ThemeColorContext = createContext<ThemeColorCtx>({
  colors: DEFAULT_COLORS,
  setColors: () => {},
  presets: PRESETS,
  darkBgPresets: DARK_BG_PRESETS,
  lightBgPresets: LIGHT_BG_PRESETS,
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

  useEffect(() => {
    const root = document.documentElement;
    const isDark = root.classList.contains('dark');

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

    if (isDark) {
      root.style.setProperty('--background', colors.background);
      root.style.setProperty('--card', colors.cardBackground);
      root.style.setProperty('--foreground', colors.foreground);
      root.style.setProperty('--card-foreground', colors.foreground);
      root.style.setProperty('--popover-foreground', colors.foreground);
    } else {
      root.style.setProperty('--background', colors.lightBackground);
      root.style.setProperty('--card', colors.lightCard);
      root.style.setProperty('--foreground', colors.lightForeground);
      root.style.setProperty('--card-foreground', colors.lightForeground);
      root.style.setProperty('--popover-foreground', colors.lightForeground);
    }
  }, [colors]);

  // Re-apply when theme class changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const root = document.documentElement;
      const isDark = root.classList.contains('dark');
      if (isDark) {
        root.style.setProperty('--background', colors.background);
        root.style.setProperty('--card', colors.cardBackground);
        root.style.setProperty('--foreground', colors.foreground);
        root.style.setProperty('--card-foreground', colors.foreground);
      } else {
        root.style.setProperty('--background', colors.lightBackground);
        root.style.setProperty('--card', colors.lightCard);
        root.style.setProperty('--foreground', colors.lightForeground);
        root.style.setProperty('--card-foreground', colors.lightForeground);
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [colors]);

  return (
    <ThemeColorContext.Provider value={{ colors, setColors, presets: PRESETS, darkBgPresets: DARK_BG_PRESETS, lightBgPresets: LIGHT_BG_PRESETS }}>
      {children}
    </ThemeColorContext.Provider>
  );
}

export function useThemeColors() {
  return useContext(ThemeColorContext);
}
