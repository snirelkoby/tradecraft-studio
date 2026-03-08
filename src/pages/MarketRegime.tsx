import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTrades } from '@/hooks/useTrades';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity } from 'lucide-react';

type Regime = 'trending' | 'ranging' | 'volatile';

function classifyRegime(trades: any[], index: number, window: number = 5): Regime {
  const start = Math.max(0, index - window);
  const slice = trades.slice(start, index + 1).filter(t => t.pnl !== null);
  if (slice.length < 2) return 'ranging';

  const pnls = slice.map(t => t.pnl ?? 0);
  const mean = pnls.reduce((s, v) => s + v, 0) / pnls.length;
  const variance = pnls.reduce((s, v) => s + (v - mean) ** 2, 0) / pnls.length;
  const stdDev = Math.sqrt(variance);
  const avgAbsPnl = pnls.reduce((s, v) => s + Math.abs(v), 0) / pnls.length;

  // Check trend: consecutive same-direction
  let sameDir = 0;
  for (let i = 1; i < pnls.length; i++) {
    if ((pnls[i] > 0 && pnls[i - 1] > 0) || (pnls[i] < 0 && pnls[i - 1] < 0)) sameDir++;
  }
  const trendScore = sameDir / (pnls.length - 1);

  const cvRatio = avgAbsPnl > 0 ? stdDev / avgAbsPnl : 0;

  if (cvRatio > 1.5) return 'volatile';
  if (trendScore > 0.6) return 'trending';
  return 'ranging';
}

const REGIME_COLORS: Record<Regime, string> = {
  trending: 'hsl(var(--chart-green))',
  ranging: 'hsl(var(--chart-blue))',
  volatile: 'hsl(var(--chart-red))',
};

const REGIME_LABELS: Record<Regime, string> = {
  trending: '📈 Trending',
  ranging: '↔️ Ranging',
  volatile: '🌊 Volatile',
};

export default function MarketRegime() {
  const { data: trades } = useTrades();
  const [windowSize, setWindowSize] = useState('5');

  const analysis = useMemo(() => {
    if (!trades) return null;
    const closed = trades.filter(t => t.status === 'closed' && t.pnl !== null)
      .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    if (closed.length < 5) return null;

    const window = parseInt(windowSize);
    const classified = closed.map((t, i) => ({
      ...t,
      regime: classifyRegime(closed, i, window),
    }));

    const regimeStats: Record<Regime, { pnl: number; count: number; wins: number }> = {
      trending: { pnl: 0, count: 0, wins: 0 },
      ranging: { pnl: 0, count: 0, wins: 0 },
      volatile: { pnl: 0, count: 0, wins: 0 },
    };

    classified.forEach(t => {
      regimeStats[t.regime].pnl += t.pnl ?? 0;
      regimeStats[t.regime].count++;
      if ((t.pnl ?? 0) > 0) regimeStats[t.regime].wins++;
    });

    const pieData = Object.entries(regimeStats)
      .filter(([, v]) => v.count > 0)
      .map(([regime, v]) => ({
        name: REGIME_LABELS[regime as Regime],
        regime: regime as Regime,
        value: v.count,
        pnl: v.pnl,
        winRate: Math.round((v.wins / v.count) * 100),
      }));

    const barData = Object.entries(regimeStats)
      .filter(([, v]) => v.count > 0)
      .map(([regime, v]) => ({
        regime: REGIME_LABELS[regime as Regime],
        key: regime as Regime,
        pnl: v.pnl,
        winRate: Math.round((v.wins / v.count) * 100),
        avgPnl: v.pnl / v.count,
        count: v.count,
      }));

    return { classified, regimeStats, pieData, barData, currentRegime: classified[classified.length - 1]?.regime };
  }, [trades, windowSize]);

  if (!analysis) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Market Regime Detector</h1>
        <p className="text-muted-foreground">צריך לפחות 5 עסקאות סגורות לניתוח.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Activity className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Market Regime Detector</h1>
            <p className="text-muted-foreground text-sm">זיהוי מצב שוק וביצועים לכל regime</p>
          </div>
        </div>
        <Select value={windowSize} onValueChange={setWindowSize}>
          <SelectTrigger className="w-40 bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3">חלון 3 עסקאות</SelectItem>
            <SelectItem value="5">חלון 5 עסקאות</SelectItem>
            <SelectItem value="10">חלון 10 עסקאות</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Current Regime */}
      <Card className="bg-card border-border">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ backgroundColor: REGIME_COLORS[analysis.currentRegime] + '22' }}>
            {analysis.currentRegime === 'trending' ? '📈' : analysis.currentRegime === 'volatile' ? '🌊' : '↔️'}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">מצב שוק נוכחי (לפי {windowSize} עסקאות אחרונות)</p>
            <p className="text-2xl font-bold" style={{ color: REGIME_COLORS[analysis.currentRegime] }}>
              {REGIME_LABELS[analysis.currentRegime]}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution Pie */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">חלוקת מצבי שוק</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={analysis.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                  {analysis.pieData.map((d) => (
                    <Cell key={d.regime} fill={REGIME_COLORS[d.regime]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance per Regime */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">P&L לפי מצב שוק</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analysis.barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="regime" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {analysis.barData.map((d) => (
                    <Cell key={d.key} fill={REGIME_COLORS[d.key]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Stats Table */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">סטטיסטיקות לפי Regime</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="py-2 text-right">Regime</th>
                  <th className="py-2 text-right">עסקאות</th>
                  <th className="py-2 text-right">Win Rate</th>
                  <th className="py-2 text-right">סה"כ P&L</th>
                  <th className="py-2 text-right">ממוצע P&L</th>
                </tr>
              </thead>
              <tbody>
                {analysis.barData.map(d => (
                  <tr key={d.key} className="border-b border-border/50">
                    <td className="py-2 font-medium" style={{ color: REGIME_COLORS[d.key] }}>{d.regime}</td>
                    <td className="py-2 font-mono">{d.count}</td>
                    <td className="py-2 font-mono">{d.winRate}%</td>
                    <td className="py-2 font-mono" style={{ color: d.pnl >= 0 ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))' }}>
                      ${d.pnl.toFixed(0)}
                    </td>
                    <td className="py-2 font-mono" style={{ color: d.avgPnl >= 0 ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))' }}>
                      ${d.avgPnl.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
