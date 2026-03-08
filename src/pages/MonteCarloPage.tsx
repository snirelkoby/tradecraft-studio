import { useState, useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { useSelectedAccount } from '@/hooks/useSelectedAccount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts';
import { Play, RotateCcw } from 'lucide-react';

export default function MonteCarloPage() {
  const { data: allTrades } = useTrades();
  const { selectedAccount } = useSelectedAccount();
  const [simCount, setSimCount] = useState(500);
  const [tradeCount, setTradeCount] = useState(100);
  const [results, setResults] = useState<number[][] | null>(null);

  const trades = useMemo(() => {
    if (!allTrades) return [];
    const filtered = selectedAccount === 'all' ? allTrades : allTrades.filter(t => t.account_name === selectedAccount);
    return filtered.filter(t => t.status === 'closed' && t.pnl !== null);
  }, [allTrades, selectedAccount]);

  const pnls = useMemo(() => trades.map(t => t.pnl ?? 0), [trades]);

  const runSimulation = () => {
    if (pnls.length === 0) return;
    const sims: number[][] = [];
    for (let s = 0; s < simCount; s++) {
      const path = [0];
      for (let i = 0; i < tradeCount; i++) {
        const randomPnl = pnls[Math.floor(Math.random() * pnls.length)];
        path.push(path[path.length - 1] + randomPnl);
      }
      sims.push(path);
    }
    setResults(sims);
  };

  // Compute percentiles
  const chartData = useMemo(() => {
    if (!results) return [];
    const len = tradeCount + 1;
    return Array.from({ length: len }, (_, i) => {
      const vals = results.map(sim => sim[i]).sort((a, b) => a - b);
      return {
        trade: i,
        p5: vals[Math.floor(vals.length * 0.05)],
        p25: vals[Math.floor(vals.length * 0.25)],
        median: vals[Math.floor(vals.length * 0.5)],
        p75: vals[Math.floor(vals.length * 0.75)],
        p95: vals[Math.floor(vals.length * 0.95)],
        mean: vals.reduce((s, v) => s + v, 0) / vals.length,
      };
    });
  }, [results, tradeCount]);

  const finalStats = useMemo(() => {
    if (!results) return null;
    const finals = results.map(sim => sim[sim.length - 1]).sort((a, b) => a - b);
    const profitable = finals.filter(v => v > 0).length;
    return {
      median: finals[Math.floor(finals.length * 0.5)],
      p5: finals[Math.floor(finals.length * 0.05)],
      p95: finals[Math.floor(finals.length * 0.95)],
      worst: finals[0],
      best: finals[finals.length - 1],
      profitProb: (profitable / finals.length * 100),
      mean: finals.reduce((s, v) => s + v, 0) / finals.length,
    };
  }, [results]);

  const tooltipStyle = {
    background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))',
    borderRadius: 8, color: 'hsl(var(--foreground))',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monte Carlo Simulation</h1>
        <p className="text-muted-foreground text-sm">סימולציה סטטיסטית — בדוק את טווח התוצאות הצפויות על בסיס הביצועים שלך</p>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Simulations</label>
          <Input type="number" value={simCount} onChange={e => setSimCount(parseInt(e.target.value) || 100)} className="bg-secondary w-32" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Trades per Sim</label>
          <Input type="number" value={tradeCount} onChange={e => setTradeCount(parseInt(e.target.value) || 50)} className="bg-secondary w-32" />
        </div>
        <div className="text-xs text-muted-foreground">Based on <span className="font-bold text-foreground">{pnls.length}</span> historical trades</div>
        <Button onClick={runSimulation} disabled={pnls.length === 0} className="font-bold">
          <Play className="h-4 w-4 mr-2" /> Run Simulation
        </Button>
        {results && (
          <Button variant="outline" onClick={() => setResults(null)}><RotateCcw className="h-4 w-4 mr-2" /> Reset</Button>
        )}
      </div>

      {pnls.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-12 text-center">
          <p className="text-muted-foreground">נדרשות עסקאות סגורות כדי להריץ סימולציה</p>
        </div>
      )}

      {finalStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {[
            { label: 'Profit Probability', value: `${finalStats.profitProb.toFixed(1)}%`, color: finalStats.profitProb >= 50 ? 'text-chart-green' : 'text-chart-red' },
            { label: 'Mean Outcome', value: `$${finalStats.mean.toFixed(0)}`, color: finalStats.mean >= 0 ? 'text-chart-green' : 'text-chart-red' },
            { label: 'Median', value: `$${finalStats.median.toFixed(0)}`, color: 'text-foreground' },
            { label: '5th Percentile', value: `$${finalStats.p5.toFixed(0)}`, color: 'text-chart-red' },
            { label: '95th Percentile', value: `$${finalStats.p95.toFixed(0)}`, color: 'text-chart-green' },
            { label: 'Best Case', value: `$${finalStats.best.toFixed(0)}`, color: 'text-chart-green' },
            { label: 'Worst Case', value: `$${finalStats.worst.toFixed(0)}`, color: 'text-chart-red' },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-secondary p-3">
              <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
              <p className={`font-mono font-bold text-sm ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {chartData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Equity Cone ({simCount} simulations)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="coneGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-blue))" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(var(--chart-blue))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="trade" stroke="hsl(var(--muted-foreground))" fontSize={11} label={{ value: 'Trade #', position: 'insideBottom', offset: -5 }} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toFixed(0)}`} />
              <Area type="monotone" dataKey="p95" stroke="none" fill="hsl(var(--chart-green))" fillOpacity={0.1} name="95th %ile" />
              <Area type="monotone" dataKey="p75" stroke="none" fill="hsl(var(--chart-green))" fillOpacity={0.1} name="75th %ile" />
              <Area type="monotone" dataKey="p25" stroke="none" fill="hsl(var(--chart-red))" fillOpacity={0.1} name="25th %ile" />
              <Area type="monotone" dataKey="p5" stroke="none" fill="hsl(var(--chart-red))" fillOpacity={0.1} name="5th %ile" />
              <Line type="monotone" dataKey="median" stroke="hsl(var(--chart-blue))" strokeWidth={2.5} dot={false} name="Median" />
              <Line type="monotone" dataKey="mean" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Mean" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
