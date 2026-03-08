import { useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { differenceInMinutes, differenceInHours } from 'date-fns';
import { Clock, TrendingUp, Timer, BarChart3 } from 'lucide-react';

export default function TimeInTrade() {
  const { data: trades } = useTrades();

  const analysis = useMemo(() => {
    if (!trades?.length) return null;

    const closed = trades.filter(t => t.status === 'closed' && t.pnl !== null && t.exit_date && t.entry_date);
    if (!closed.length) return null;

    const points = closed.map(t => {
      const mins = differenceInMinutes(new Date(t.exit_date!), new Date(t.entry_date));
      const hours = mins / 60;
      return {
        symbol: t.symbol,
        duration: hours,
        durationLabel: hours < 1 ? `${mins}m` : hours < 24 ? `${hours.toFixed(1)}h` : `${(hours / 24).toFixed(1)}d`,
        pnl: t.pnl ?? 0,
        strategy: t.strategy ?? 'N/A',
        win: (t.pnl ?? 0) > 0,
      };
    }).filter(p => p.duration >= 0);

    // Stats by duration bucket
    const buckets = [
      { label: '< 15m', min: 0, max: 0.25 },
      { label: '15m–1h', min: 0.25, max: 1 },
      { label: '1h–4h', min: 1, max: 4 },
      { label: '4h–1d', min: 4, max: 24 },
      { label: '1d+', min: 24, max: Infinity },
    ];

    const bucketStats = buckets.map(b => {
      const inBucket = points.filter(p => p.duration >= b.min && p.duration < b.max);
      const wins = inBucket.filter(p => p.win);
      const totalPnl = inBucket.reduce((s, p) => s + p.pnl, 0);
      return {
        label: b.label,
        count: inBucket.length,
        winRate: inBucket.length > 0 ? (wins.length / inBucket.length) * 100 : 0,
        avgPnl: inBucket.length > 0 ? totalPnl / inBucket.length : 0,
        totalPnl,
      };
    });

    const avgDuration = points.reduce((s, p) => s + p.duration, 0) / points.length;
    const winAvgDuration = points.filter(p => p.win).length > 0
      ? points.filter(p => p.win).reduce((s, p) => s + p.duration, 0) / points.filter(p => p.win).length : 0;
    const lossAvgDuration = points.filter(p => !p.win).length > 0
      ? points.filter(p => !p.win).reduce((s, p) => s + p.duration, 0) / points.filter(p => !p.win).length : 0;

    return { points, bucketStats, avgDuration, winAvgDuration, lossAvgDuration };
  }, [trades]);

  const fmtHours = (h: number) => h < 1 ? `${(h * 60).toFixed(0)}m` : h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;

  if (!analysis) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Time-in-Trade Analysis</h1>
        <Card><CardContent className="py-12 text-center text-muted-foreground">אין מספיק עסקאות סגורות לניתוח</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Time-in-Trade Analysis</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <Clock className="h-5 w-5 mx-auto mb-2 text-primary" />
          <p className="text-2xl font-bold">{fmtHours(analysis.avgDuration)}</p>
          <p className="text-xs text-muted-foreground">Avg Duration</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <TrendingUp className="h-5 w-5 mx-auto mb-2 text-green-500" />
          <p className="text-2xl font-bold">{fmtHours(analysis.winAvgDuration)}</p>
          <p className="text-xs text-muted-foreground">Avg Win Duration</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Timer className="h-5 w-5 mx-auto mb-2 text-destructive" />
          <p className="text-2xl font-bold">{fmtHours(analysis.lossAvgDuration)}</p>
          <p className="text-xs text-muted-foreground">Avg Loss Duration</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <BarChart3 className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
          <p className="text-2xl font-bold">{analysis.points.length}</p>
          <p className="text-xs text-muted-foreground">Trades Analyzed</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Duration vs P&L Scatter</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" dataKey="duration" name="Duration (hrs)" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} label={{ value: 'Duration (hours)', position: 'insideBottom', offset: -5, style: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 } }} />
              <YAxis type="number" dataKey="pnl" name="P&L" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} label={{ value: 'P&L ($)', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 } }} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }}
                formatter={(val: number, name: string) => [name === 'P&L' ? `$${val.toFixed(2)}` : `${val.toFixed(1)}h`, name]}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Scatter data={analysis.points} name="Trades">
                {analysis.points.map((p, i) => (
                  <Cell key={i} fill={p.win ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} fillOpacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Performance by Duration</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analysis.bucketStats.map(b => (
              <div key={b.label} className="grid grid-cols-5 gap-4 items-center rounded-lg border border-border bg-secondary/30 p-3">
                <span className="font-mono font-bold text-sm">{b.label}</span>
                <span className="text-sm text-center">{b.count} trades</span>
                <span className={`text-sm text-center font-medium ${b.winRate >= 50 ? 'text-green-500' : 'text-destructive'}`}>{b.winRate.toFixed(0)}% WR</span>
                <span className={`text-sm text-center ${b.avgPnl >= 0 ? 'text-green-500' : 'text-destructive'}`}>${b.avgPnl.toFixed(0)} avg</span>
                <span className={`text-sm text-right font-bold ${b.totalPnl >= 0 ? 'text-green-500' : 'text-destructive'}`}>${b.totalPnl.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
