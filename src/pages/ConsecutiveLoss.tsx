import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTrades } from '@/hooks/useTrades';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingDown } from 'lucide-react';

export default function ConsecutiveLoss() {
  const { data: trades } = useTrades();

  const analysis = useMemo(() => {
    if (!trades) return null;
    const closed = trades.filter(t => t.status === 'closed' && t.pnl !== null)
      .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    if (closed.length < 10) return null;

    // Find performance AFTER consecutive losses
    const afterLossStreak: Record<number, { pnls: number[]; wins: number }> = {};

    let streak = 0;
    for (let i = 0; i < closed.length; i++) {
      const pnl = closed[i].pnl ?? 0;
      if (pnl < 0) {
        streak++;
      } else {
        // This trade breaks the streak - record it
        if (streak >= 1 && i < closed.length) {
          const key = Math.min(streak, 5); // Cap at 5+
          if (!afterLossStreak[key]) afterLossStreak[key] = { pnls: [], wins: 0 };
          afterLossStreak[key].pnls.push(pnl);
          if (pnl > 0) afterLossStreak[key].wins++;
        }
        streak = 0;
      }
    }

    // Also track: after 0 losses (no streak)
    let prevLoss = false;
    const afterNoLoss: number[] = [];
    for (let i = 1; i < closed.length; i++) {
      if ((closed[i - 1].pnl ?? 0) >= 0 && (closed[i].pnl ?? 0) !== 0) {
        afterNoLoss.push(closed[i].pnl ?? 0);
      }
    }

    const barData = [
      { streak: 'אחרי 0 הפסדים', avgPnl: afterNoLoss.length > 0 ? afterNoLoss.reduce((s, v) => s + v, 0) / afterNoLoss.length : 0, winRate: afterNoLoss.length > 0 ? Math.round(afterNoLoss.filter(p => p > 0).length / afterNoLoss.length * 100) : 0, count: afterNoLoss.length },
      ...([1, 2, 3, 4, 5] as number[]).map(n => ({
        streak: n === 5 ? 'אחרי 5+ הפסדים' : `אחרי ${n} הפסדים`,
        avgPnl: afterLossStreak[n] ? afterLossStreak[n].pnls.reduce((s, v) => s + v, 0) / afterLossStreak[n].pnls.length : 0,
        winRate: afterLossStreak[n] ? Math.round(afterLossStreak[n].wins / afterLossStreak[n].pnls.length * 100) : 0,
        count: afterLossStreak[n]?.pnls.length ?? 0,
      })),
    ].filter(d => d.count > 0);

    // Equity impact after loss streaks - running equity
    const equityData: { trade: number; equity: number; streakBefore: number }[] = [];
    let equity = 0;
    streak = 0;
    for (let i = 0; i < closed.length; i++) {
      const pnl = closed[i].pnl ?? 0;
      if (pnl < 0) streak++;
      else streak = 0;
      equity += pnl;
      equityData.push({ trade: i + 1, equity, streakBefore: streak });
    }

    // Max consecutive losses
    let maxStreak = 0;
    streak = 0;
    for (const t of closed) {
      if ((t.pnl ?? 0) < 0) { streak++; maxStreak = Math.max(maxStreak, streak); }
      else streak = 0;
    }

    return { barData, equityData, maxStreak, totalClosed: closed.length };
  }, [trades]);

  if (!analysis) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Consecutive Loss Impact</h1>
        <p className="text-muted-foreground">צריך לפחות 10 עסקאות סגורות.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingDown className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Consecutive Loss Impact</h1>
          <p className="text-muted-foreground text-sm">איך הביצועים שלך משתנים אחרי רצף הפסדים — {analysis.totalClosed} עסקאות</p>
        </div>
      </div>

      {/* Max streak */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">רצף הפסדים מקסימלי</p>
            <p className="text-3xl font-bold font-mono" style={{ color: 'hsl(var(--chart-red))' }}>{analysis.maxStreak}</p>
          </CardContent>
        </Card>
        {analysis.barData.length > 1 && (
          <>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Win Rate רגיל</p>
                <p className="text-3xl font-bold font-mono">{analysis.barData[0]?.winRate}%</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Win Rate אחרי 2+ הפסדים</p>
                <p className="text-3xl font-bold font-mono" style={{ color: analysis.barData.find(d => d.streak.includes('2'))?.winRate ?? 0 > (analysis.barData[0]?.winRate ?? 0) ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))' }}>
                  {analysis.barData.find(d => d.streak.includes('2'))?.winRate ?? 'N/A'}%
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Avg PnL after streaks */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">ממוצע P&L אחרי רצף הפסדים</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analysis.barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="streak" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="avgPnl" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Win Rate after streaks */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">Win Rate אחרי רצף הפסדים</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analysis.barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="streak" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="winRate" fill="hsl(var(--chart-green))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Equity with streak markers */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">עקומת הון עם סימון רצפי הפסדים</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analysis.equityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="trade" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                formatter={(v: number, name: string) => [name === 'equity' ? `$${v.toFixed(0)}` : v, name === 'equity' ? 'הון' : 'רצף הפסדים']} />
              <Line type="monotone" dataKey="equity" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
