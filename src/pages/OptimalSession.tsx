import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTrades } from '@/hooks/useTrades';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine } from 'recharts';
import { Clock } from 'lucide-react';

export default function OptimalSession() {
  const { data: trades } = useTrades();

  const analysis = useMemo(() => {
    if (!trades) return null;
    const closed = trades.filter(t => t.status === 'closed' && t.pnl !== null && t.exit_date)
      .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    if (closed.length < 10) return null;

    // Group trades by session (same day)
    const sessions: Record<string, typeof closed> = {};
    closed.forEach(t => {
      const day = new Date(t.entry_date).toISOString().slice(0, 10);
      if (!sessions[day]) sessions[day] = [];
      sessions[day].push(t);
    });

    // For each session, calculate cumulative PnL by trade number
    const tradeNumberPnl: Record<number, { pnls: number[]; wins: number }> = {};
    Object.values(sessions).forEach(dayTrades => {
      const sorted = dayTrades.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
      sorted.forEach((t, i) => {
        const num = i + 1;
        if (!tradeNumberPnl[num]) tradeNumberPnl[num] = { pnls: [], wins: 0 };
        tradeNumberPnl[num].pnls.push(t.pnl ?? 0);
        if ((t.pnl ?? 0) > 0) tradeNumberPnl[num].wins++;
      });
    });

    const tradeNumChart = Object.entries(tradeNumberPnl)
      .map(([num, data]) => ({
        tradeNum: `עסקה #${num}`,
        num: parseInt(num),
        avgPnl: data.pnls.reduce((s, v) => s + v, 0) / data.pnls.length,
        winRate: Math.round((data.wins / data.pnls.length) * 100),
        count: data.pnls.length,
      }))
      .filter(d => d.count >= 3)
      .sort((a, b) => a.num - b.num);

    // Hours of trading in session vs performance
    const sessionHours: { hours: number; pnl: number; trades: number }[] = [];
    Object.values(sessions).forEach(dayTrades => {
      if (dayTrades.length < 1) return;
      const times = dayTrades.map(t => new Date(t.entry_date).getTime());
      const exitTimes = dayTrades.map(t => t.exit_date ? new Date(t.exit_date).getTime() : new Date(t.entry_date).getTime());
      const sessionStart = Math.min(...times);
      const sessionEnd = Math.max(...exitTimes);
      const hours = (sessionEnd - sessionStart) / 3600000;
      const pnl = dayTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
      sessionHours.push({ hours: Math.round(hours * 10) / 10, pnl, trades: dayTrades.length });
    });

    // Bucket by hours
    const hourBuckets = [
      { label: '0-1h', min: 0, max: 1 },
      { label: '1-2h', min: 1, max: 2 },
      { label: '2-3h', min: 2, max: 3 },
      { label: '3-4h', min: 3, max: 4 },
      { label: '4-6h', min: 4, max: 6 },
      { label: '6h+', min: 6, max: Infinity },
    ];
    const hourBucketData = hourBuckets.map(b => {
      const bucket = sessionHours.filter(s => s.hours >= b.min && s.hours < b.max);
      return {
        range: b.label,
        avgPnl: bucket.length > 0 ? bucket.reduce((s, v) => s + v.pnl, 0) / bucket.length : 0,
        sessions: bucket.length,
      };
    }).filter(d => d.sessions > 0);

    // Find optimal
    const optimalBucket = hourBucketData.reduce((best, d) => d.avgPnl > best.avgPnl ? d : best, hourBucketData[0]);
    let bestCum = 0;
    let bestNum = tradeNumChart[0];
    let runCum = 0;
    for (const d of tradeNumChart) {
      runCum += d.avgPnl;
      if (runCum > bestCum) { bestCum = runCum; bestNum = d; }
    }
    const optimalTradeNum = tradeNumChart.length > 0 ? bestNum : null;

    // Cumulative by trade number
    let cum = 0;
    const cumulativeChart = tradeNumChart.map(d => {
      cum += d.avgPnl;
      return { ...d, cumAvgPnl: cum };
    });

    return { tradeNumChart, hourBucketData, optimalBucket, optimalTradeNum, cumulativeChart, totalSessions: Object.keys(sessions).length };
  }, [trades]);

  if (!analysis) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Optimal Session Length</h1>
        <p className="text-muted-foreground">צריך לפחות 10 עסקאות סגורות.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Optimal Session Length</h1>
          <p className="text-muted-foreground text-sm">מציאת הזמן האופטימלי למסחר — {analysis.totalSessions} סשנים</p>
        </div>
      </div>

      {/* Key Findings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="bg-card border-border border-l-4" style={{ borderLeftColor: 'hsl(var(--chart-green))' }}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">אורך סשן אופטימלי</p>
            <p className="text-2xl font-bold font-mono" style={{ color: 'hsl(var(--chart-green))' }}>{analysis.optimalBucket?.range ?? 'N/A'}</p>
            <p className="text-sm text-muted-foreground">ממוצע: ${analysis.optimalBucket?.avgPnl.toFixed(0) ?? 0} לסשן</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-l-4" style={{ borderLeftColor: 'hsl(var(--primary))' }}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">מספר עסקאות אופטימלי לסשן</p>
            <p className="text-2xl font-bold font-mono" style={{ color: 'hsl(var(--primary))' }}>
              {analysis.optimalTradeNum?.num ?? 'N/A'}
            </p>
            <p className="text-sm text-muted-foreground">שיא P&L מצטבר ממוצע</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session duration vs PnL */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">ממוצע P&L לפי אורך סשן</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analysis.hourBucketData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="range" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="avgPnl" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cumulative PnL by trade number */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">P&L מצטבר ממוצע לפי מספר עסקה בסשן</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analysis.cumulativeChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="tradeNum" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="cumAvgPnl" stroke="hsl(var(--chart-green))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--chart-green))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Trade number breakdown */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">ביצועים לפי מספר עסקה ביום</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="py-2 text-right">עסקה #</th>
                  <th className="py-2 text-right">ממוצע P&L</th>
                  <th className="py-2 text-right">Win Rate</th>
                  <th className="py-2 text-right">מדגם</th>
                </tr>
              </thead>
              <tbody>
                {analysis.tradeNumChart.map(d => (
                  <tr key={d.num} className="border-b border-border/50">
                    <td className="py-2 font-medium">{d.tradeNum}</td>
                    <td className="py-2 font-mono" style={{ color: d.avgPnl >= 0 ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))' }}>
                      ${d.avgPnl.toFixed(0)}
                    </td>
                    <td className="py-2 font-mono">{d.winRate}%</td>
                    <td className="py-2 font-mono text-muted-foreground">{d.count}</td>
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
