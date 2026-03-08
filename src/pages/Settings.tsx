import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check } from 'lucide-react';

function hslToHex(hsl: string): string {
  const parts = hsl.split(' ');
  const h = parseFloat(parts[0]) || 0;
  const s = (parseFloat(parts[1]) || 0) / 100;
  const l = (parseFloat(parts[2]) || 0) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): string {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { colors, setColors, presets } = useThemeColors();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">חשבון והתאמה אישית</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-lg">Account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Email</p>
            <p className="font-mono text-sm">{user?.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">User ID</p>
            <p className="font-mono text-xs text-muted-foreground">{user?.id}</p>
          </div>
          <Button variant="destructive" onClick={signOut}>Sign Out</Button>
        </CardContent>
      </Card>

      {/* Theme Colors */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-lg">Theme Colors</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {/* Accent Color */}
          <div>
            <label className="text-xs text-muted-foreground uppercase mb-2 block">Accent Color</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(presets).map(([name, hsl]) => (
                <button
                  key={name}
                  onClick={() => setColors({ accent: hsl })}
                  className="relative w-10 h-10 rounded-lg border-2 transition-all hover:scale-110"
                  style={{
                    backgroundColor: `hsl(${hsl})`,
                    borderColor: colors.accent === hsl ? 'hsl(var(--foreground))' : 'transparent',
                  }}
                  title={name}
                >
                  {colors.accent === hsl && <Check className="h-4 w-4 text-white absolute inset-0 m-auto" />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={hslToHex(colors.accent)}
                onChange={e => setColors({ accent: hexToHsl(e.target.value) })}
                className="w-12 h-10 p-1 cursor-pointer bg-secondary"
              />
              <span className="text-xs text-muted-foreground font-mono">Custom color picker</span>
            </div>
          </div>

          {/* Positive Color */}
          <div>
            <label className="text-xs text-muted-foreground uppercase mb-2 block">Positive Color (Profit)</label>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={hslToHex(colors.positive)}
                onChange={e => setColors({ positive: hexToHsl(e.target.value) })}
                className="w-12 h-10 p-1 cursor-pointer bg-secondary"
              />
              <div className="h-10 w-24 rounded-lg flex items-center justify-center font-mono font-bold text-sm" style={{ backgroundColor: `hsl(${colors.positive})`, color: 'white' }}>
                +$100
              </div>
              <Button variant="ghost" size="sm" onClick={() => setColors({ positive: '142 71% 45%' })}>Reset</Button>
            </div>
          </div>

          {/* Negative Color */}
          <div>
            <label className="text-xs text-muted-foreground uppercase mb-2 block">Negative Color (Loss)</label>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={hslToHex(colors.negative)}
                onChange={e => setColors({ negative: hexToHsl(e.target.value) })}
                className="w-12 h-10 p-1 cursor-pointer bg-secondary"
              />
              <div className="h-10 w-24 rounded-lg flex items-center justify-center font-mono font-bold text-sm" style={{ backgroundColor: `hsl(${colors.negative})`, color: 'white' }}>
                -$100
              </div>
              <Button variant="ghost" size="sm" onClick={() => setColors({ negative: '270 70% 55%' })}>Reset</Button>
            </div>
          </div>

          {/* Background */}
          <div>
            <label className="text-xs text-muted-foreground uppercase mb-2 block">Background Color (Dark Mode)</label>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={hslToHex(colors.background)}
                onChange={e => setColors({ background: hexToHsl(e.target.value) })}
                className="w-12 h-10 p-1 cursor-pointer bg-secondary"
              />
              <span className="text-xs text-muted-foreground font-mono">{colors.background}</span>
              <Button variant="ghost" size="sm" onClick={() => setColors({ background: '220 20% 3%' })}>Reset</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
