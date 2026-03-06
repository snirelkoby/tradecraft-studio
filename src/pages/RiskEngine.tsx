import { useTrades, useTradeStats } from '@/hooks/useTrades';
import { KpiCard } from '@/components/KpiCard';

export default function RiskEngine() {
  const { data: trades } = useTrades();
  const stats = useTradeStats(trades);

  const closed = (trades ?? []).filter(t => t.status === 'closed' && t.pnl !== null);

  // Consecutive wins/losses
  let maxConsecWins = 0, maxConsecLosses = 0, curWins = 0, curLosses = 0;
  closed.forEach(t => {
    if ((t.pnl ?? 0) > 0) { curWins++; curLosses = 0; maxConsecWins = Math.max(maxConsecWins, curWins); }
    else { curLosses++; curWins = 0; maxConsecLosses = Math.max(maxConsecLosses, curLosses); }
  });

  // Max drawdown
  let peak = 0, maxDD = 0, cumPnl = 0;
  closed.forEach(t => {
    cumPnl += t.pnl ?? 0;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak - cumPnl;
    if (dd > maxDD) maxDD = dd;
  });

  // Expectancy
  const expectancy = stats.totalTrades > 0
    ? (stats.winRate / 100) * stats.avgWin - ((100 - stats.winRate) / 100) * stats.avgLoss
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quantitative Risk Engine</h1>
        <p className="text-muted-foreground text-sm">Risk metrics and position analysis</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Profit Factor" value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)} variant={stats.profitFactor >= 1 ? 'green' : 'red'} />
        <KpiCard title="Expectancy" value={`$${expectancy.toFixed(2)}`} variant={expectancy >= 0 ? 'green' : 'red'} />
        <KpiCard title="Avg R:R" value={stats.avgRR.toFixed(2)} variant={stats.avgRR >= 1 ? 'green' : 'red'} />
        <KpiCard title="Max Drawdown" value={`-$${maxDD.toFixed(2)}`} variant="red" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Consec. Wins" value={maxConsecWins.toString()} variant="green" />
        <KpiCard title="Consec. Losses" value={maxConsecLosses.toString()} variant="red" />
        <KpiCard title="Win Rate" value={`${stats.winRate.toFixed(1)}%`} variant={stats.winRate >= 50 ? 'green' : 'red'} />
        <KpiCard title="Total P&L" value={`$${stats.totalPnl.toFixed(2)}`} variant={stats.totalPnl >= 0 ? 'green' : 'red'} />
      </div>

      {/* Strategy breakdown */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Performance by Strategy</h3>
        <div className="space-y-3">
          {['AAA', 'AA', 'A', 'B', 'C', 'D'].map(strat => {
            const stratTrades = closed.filter(t => t.strategy === strat);
            if (stratTrades.length === 0) return null;
            const pnl = stratTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
            const wins = stratTrades.filter(t => (t.pnl ?? 0) > 0).length;
            const wr = (wins / stratTrades.length) * 100;
            return (
              <div key={strat} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="font-mono font-bold">{strat}</span>
                <div className="flex gap-6 text-sm">
                  <span className="text-muted-foreground">{stratTrades.length} trades</span>
                  <span className="text-muted-foreground">{wr.toFixed(0)}% WR</span>
                  <span className={`font-mono font-bold ${pnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
