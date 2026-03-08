import { useState, useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';

export default function AbStrategyTester() {
  const { data: trades } = useTrades();
  const [stratA, setStratA] = useState('');
  const [stratB, setStratB] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const strategies = useMemo(() => {
    if (!trades) return [];
    const set = new Set(trades.filter(t => t.strategy).map(t => t.strategy!));
    return Array.from(set).sort();
  }, [trades]);

  const comparison = useMemo(() => {
    if (!trades || !stratA || !stratB) return null;

    const filter = (strat: string) => {
      let filtered = trades.filter(t => t.strategy === strat && t.status === 'closed' && t.pnl !== null);
      if (dateFrom) filtered = filtered.filter(t => t.entry_date >= dateFrom);
      if (dateTo) filtered = filtered.filter(t => t.entry_date <= dateTo);
      return filtered.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    };

    const tradesA = filter(stratA);
    const tradesB = filter(stratB);

    const calcStats = (arr: typeof tradesA) => {
      const wins = arr.filter(t => (t.pnl ?? 0) > 0);
      const losses = arr.filter(t => (t.pnl ?? 0) < 0);
      const totalPnl = arr.reduce((s, t) => s + (t.pnl ?? 0), 0);
      const grossProfit = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
      const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
      return {
        count: arr.length,
        totalPnl,
        winRate: arr.length > 0 ? (wins.length / arr.length) * 100 : 0,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
        avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
        avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
        best: arr.length > 0 ? Math.max(...arr.map(t => t.pnl ?? 0)) : 0,
        worst: arr.length > 0 ? Math.min(...arr.map(t => t.pnl ?? 0)) : 0,
      };
    };

    const statsA = calcStats(tradesA);
    const statsB = calcStats(tradesB);

    // Build equity curves
    let cumA = 0, cumB = 0;
    const allDates = new Set([...tradesA.map(t => format(new Date(t.entry_date), 'MM/dd')), ...tradesB.map(t => format(new Date(t.entry_date), 'MM/dd'))]);
    const mapA: Record<string, number> = {};
    const mapB: Record<string, number> = {};
    tradesA.forEach(t => {
      const d = format(new Date(t.entry_date), 'MM/dd');
      cumA += t.pnl ?? 0;
      mapA[d] = cumA;
    });
    tradesB.forEach(t => {
      const d = format(new Date(t.entry_date), 'MM/dd');
      cumB += t.pnl ?? 0;
      mapB[d] = cumB;
    });

    let lastA = 0, lastB = 0;
    const chartData = Array.from(allDates).sort().map(d => {
      if (mapA[d] !== undefined) lastA = mapA[d];
      if (mapB[d] !== undefined) lastB = mapB[d];
      return { date: d, [stratA]: lastA, [stratB]: lastB };
    });

    return { statsA, statsB, chartData };
  }, [trades, stratA, stratB, dateFrom, dateTo]);

  const StatRow = ({ label, a, b, fmt = (v: number) => v.toFixed(2) }: { label: string; a: number; b: number; fmt?: (v: number) => string }) => (
    <div className="grid grid-cols-3 gap-4 py-2 border-b border-border">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-mono text-center ${a > b ? 'text-green-500 font-bold' : ''}`}>{fmt(a)}</span>
      <span className={`text-sm font-mono text-center ${b > a ? 'text-green-500 font-bold' : ''}`}>{fmt(b)}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">A/B Strategy Tester</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Select value={stratA} onValueChange={setStratA}>
          <SelectTrigger><SelectValue placeholder="Strategy A" /></SelectTrigger>
          <SelectContent>{strategies.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={stratB} onValueChange={setStratB}>
          <SelectTrigger><SelectValue placeholder="Strategy B" /></SelectTrigger>
          <SelectContent>{strategies.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To" />
      </div>

      {comparison ? (
        <>
          <Card>
            <CardHeader><CardTitle>Equity Comparison</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={comparison.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                  <Legend />
                  <Area type="monotone" dataKey={stratA} stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                  <Area type="monotone" dataKey={stratB} stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="grid grid-cols-3 gap-4">
                <CardTitle className="text-sm">Metric</CardTitle>
                <CardTitle className="text-sm text-center text-primary">{stratA}</CardTitle>
                <CardTitle className="text-sm text-center text-amber-500">{stratB}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <StatRow label="Total P&L" a={comparison.statsA.totalPnl} b={comparison.statsB.totalPnl} fmt={v => `$${v.toFixed(0)}`} />
              <StatRow label="Trade Count" a={comparison.statsA.count} b={comparison.statsB.count} fmt={v => v.toString()} />
              <StatRow label="Win Rate" a={comparison.statsA.winRate} b={comparison.statsB.winRate} fmt={v => `${v.toFixed(1)}%`} />
              <StatRow label="Profit Factor" a={comparison.statsA.profitFactor} b={comparison.statsB.profitFactor} />
              <StatRow label="Avg Win" a={comparison.statsA.avgWin} b={comparison.statsB.avgWin} fmt={v => `$${v.toFixed(0)}`} />
              <StatRow label="Avg Loss" a={comparison.statsA.avgLoss} b={comparison.statsB.avgLoss} fmt={v => `$${v.toFixed(0)}`} />
              <StatRow label="Best Trade" a={comparison.statsA.best} b={comparison.statsB.best} fmt={v => `$${v.toFixed(0)}`} />
              <StatRow label="Worst Trade" a={comparison.statsA.worst} b={comparison.statsB.worst} fmt={v => `$${v.toFixed(0)}`} />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card><CardContent className="py-12 text-center text-muted-foreground">בחר שתי אסטרטגיות להשוואה</CardContent></Card>
      )}
    </div>
  );
}
