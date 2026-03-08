import { useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, differenceInDays } from 'date-fns';
import { TrendingDown, Clock, AlertTriangle, BarChart3 } from 'lucide-react';

export default function DrawdownAnalyzer() {
  const { data: trades } = useTrades();

  const analysis = useMemo(() => {
    if (!trades?.length) return null;

    const closed = trades
      .filter(t => t.status === 'closed' && t.pnl !== null && t.exit_date)
      .sort((a, b) => new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime());

    if (!closed.length) return null;

    // Build equity curve
    let cumPnl = 0;
    let peak = 0;
    const equityData: { date: string; equity: number; drawdown: number; drawdownPct: number }[] = [];
    const drawdowns: { start: string; end: string | null; maxDd: number; maxDdPct: number; recovered: boolean; recoveryDays: number }[] = [];
    let inDrawdown = false;
    let ddStart = '';
    let ddMax = 0;
    let ddMaxPct = 0;

    closed.forEach(t => {
      cumPnl += t.pnl ?? 0;
      if (cumPnl > peak) {
        if (inDrawdown) {
          drawdowns.push({ start: ddStart, end: format(new Date(t.exit_date!), 'yyyy-MM-dd'), maxDd: ddMax, maxDdPct: ddMaxPct, recovered: true, recoveryDays: differenceInDays(new Date(t.exit_date!), new Date(ddStart)) });
          inDrawdown = false;
        }
        peak = cumPnl;
      }
      const dd = cumPnl - peak;
      const ddPct = peak > 0 ? (dd / peak) * 100 : 0;

      if (dd < 0 && !inDrawdown) {
        inDrawdown = true;
        ddStart = format(new Date(t.exit_date!), 'yyyy-MM-dd');
        ddMax = dd;
        ddMaxPct = ddPct;
      }
      if (inDrawdown) {
        if (dd < ddMax) { ddMax = dd; ddMaxPct = ddPct; }
      }

      equityData.push({
        date: format(new Date(t.exit_date!), 'MM/dd'),
        equity: cumPnl,
        drawdown: dd,
        drawdownPct: ddPct,
      });
    });

    if (inDrawdown) {
      drawdowns.push({ start: ddStart, end: null, maxDd: ddMax, maxDdPct: ddMaxPct, recovered: false, recoveryDays: differenceInDays(new Date(), new Date(ddStart)) });
    }

    const maxDrawdown = Math.min(...equityData.map(d => d.drawdown));
    const maxDrawdownPct = Math.min(...equityData.map(d => d.drawdownPct));
    const avgRecovery = drawdowns.filter(d => d.recovered).length > 0
      ? drawdowns.filter(d => d.recovered).reduce((s, d) => s + d.recoveryDays, 0) / drawdowns.filter(d => d.recovered).length
      : 0;

    return { equityData, drawdowns, maxDrawdown, maxDrawdownPct, avgRecovery, totalDrawdowns: drawdowns.length };
  }, [trades]);

  if (!analysis) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Drawdown Analyzer</h1>
        <Card><CardContent className="py-12 text-center text-muted-foreground">אין מספיק עסקאות סגורות לניתוח</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Drawdown Analyzer</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <TrendingDown className="h-5 w-5 mx-auto mb-2 text-destructive" />
          <p className="text-2xl font-bold text-destructive">${analysis.maxDrawdown.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Max Drawdown</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-orange-500" />
          <p className="text-2xl font-bold">{analysis.maxDrawdownPct.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">Max DD %</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Clock className="h-5 w-5 mx-auto mb-2 text-blue-500" />
          <p className="text-2xl font-bold">{analysis.avgRecovery.toFixed(0)}d</p>
          <p className="text-xs text-muted-foreground">Avg Recovery</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <BarChart3 className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
          <p className="text-2xl font-bold">{analysis.totalDrawdowns}</p>
          <p className="text-xs text-muted-foreground">Total Drawdowns</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Underwater Equity Chart</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analysis.equityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="drawdown" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.3} name="Drawdown ($)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Drawdown Periods</CardTitle></CardHeader>
        <CardContent>
          {analysis.drawdowns.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">אין drawdowns</p>
          ) : (
            <div className="space-y-2">
              {analysis.drawdowns.map((d, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
                  <div>
                    <p className="font-mono text-sm">{d.start} → {d.end ?? 'Ongoing'}</p>
                    <p className="text-xs text-muted-foreground">{d.recoveryDays} days {d.recovered ? '✅ Recovered' : '⏳ Active'}</p>
                  </div>
                  <p className="text-destructive font-bold">${d.maxDd.toFixed(0)} ({d.maxDdPct.toFixed(1)}%)</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
