import { useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { useSelectedAccount } from '@/hooks/useSelectedAccount';
import { format, parseISO, getHours } from 'date-fns';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function RiskRewardHeatmap() {
  const { data: allTrades } = useTrades();
  const { selectedAccount } = useSelectedAccount();

  const trades = useMemo(() => {
    if (!allTrades) return [];
    const filtered = selectedAccount === 'all' ? allTrades : allTrades.filter(t => t.account_name === selectedAccount);
    return filtered.filter(t => t.status === 'closed' && t.pnl !== null);
  }, [allTrades, selectedAccount]);

  // Time heatmap: day x hour
  const timeHeatmap = useMemo(() => {
    const grid: Record<string, { totalRR: number; count: number }> = {};
    trades.forEach(t => {
      const d = parseISO(t.entry_date);
      const day = d.getDay();
      const hour = getHours(d);
      const key = `${day}-${hour}`;
      if (!grid[key]) grid[key] = { totalRR: 0, count: 0 };
      const rr = t.stop_loss && t.entry_price
        ? Math.abs((t.exit_price ?? t.entry_price) - t.entry_price) / Math.abs(t.entry_price - t.stop_loss)
        : (t.pnl ?? 0) >= 0 ? 1 : -1;
      grid[key].totalRR += rr;
      grid[key].count += 1;
    });
    return grid;
  }, [trades]);

  // Strategy heatmap
  const strategyData = useMemo(() => {
    const map: Record<string, { totalRR: number; count: number; pnl: number }> = {};
    trades.forEach(t => {
      const s = t.strategy || 'No Strategy';
      if (!map[s]) map[s] = { totalRR: 0, count: 0, pnl: 0 };
      const rr = t.stop_loss && t.entry_price
        ? Math.abs(((t.exit_price ?? t.entry_price) - t.entry_price)) / Math.abs(t.entry_price - t.stop_loss)
        : (t.pnl ?? 0) >= 0 ? 1 : 0;
      map[s].totalRR += rr;
      map[s].count += 1;
      map[s].pnl += t.pnl ?? 0;
    });
    return Object.entries(map).map(([strategy, data]) => ({
      strategy,
      avgRR: data.count > 0 ? data.totalRR / data.count : 0,
      count: data.count,
      pnl: data.pnl,
    })).sort((a, b) => b.avgRR - a.avgRR);
  }, [trades]);

  const getColor = (avgRR: number) => {
    if (avgRR >= 2) return 'bg-chart-green/80 text-white';
    if (avgRR >= 1) return 'bg-chart-green/40';
    if (avgRR >= 0.5) return 'bg-chart-green/20';
    if (avgRR > 0) return 'bg-muted';
    if (avgRR === 0) return 'bg-secondary';
    return 'bg-chart-red/30';
  };

  const activeHours = HOURS.filter(h => h >= 6 && h <= 22);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Risk/Reward Heatmap</h1>
        <p className="text-muted-foreground text-sm">מפת חום של R:R לפי יום, שעה ואסטרטגיה</p>
      </div>

      {/* Time heatmap */}
      <div className="rounded-xl border border-border bg-card p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">R:R by Day & Hour</h3>
        <div className="min-w-[600px]">
          <div className="grid gap-1" style={{ gridTemplateColumns: `80px repeat(${activeHours.length}, 1fr)` }}>
            <div />
            {activeHours.map(h => (
              <div key={h} className="text-[10px] text-muted-foreground text-center font-mono">{h}:00</div>
            ))}
            {DAYS.map((day, dayIdx) => (
              <>
                <div key={`label-${dayIdx}`} className="text-xs font-mono text-muted-foreground flex items-center">{day}</div>
                {activeHours.map(hour => {
                  const key = `${dayIdx}-${hour}`;
                  const cell = timeHeatmap[key];
                  const avgRR = cell ? cell.totalRR / cell.count : 0;
                  return (
                    <div
                      key={`${dayIdx}-${hour}`}
                      className={`h-8 rounded flex items-center justify-center text-[10px] font-mono transition-colors ${cell ? getColor(avgRR) : 'bg-secondary/30'}`}
                      title={cell ? `Avg R:R ${avgRR.toFixed(2)} (${cell.count} trades)` : 'No trades'}
                    >
                      {cell ? avgRR.toFixed(1) : ''}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
          <span>Legend:</span>
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-chart-red/30 inline-block" /> {'<0'}</span>
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-muted inline-block" /> 0-0.5</span>
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-chart-green/20 inline-block" /> 0.5-1</span>
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-chart-green/40 inline-block" /> 1-2</span>
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-chart-green/80 inline-block" /> 2+</span>
        </div>
      </div>

      {/* Strategy R:R */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">R:R by Strategy</h3>
        {strategyData.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No closed trades with strategies</p>
        ) : (
          <div className="space-y-2">
            {strategyData.map(s => (
              <div key={s.strategy} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <span className="text-sm font-medium flex-1 min-w-0 truncate">{s.strategy}</span>
                <span className="text-xs text-muted-foreground">{s.count} trades</span>
                <span className={`font-mono font-bold text-sm min-w-[60px] text-right ${s.pnl >= 0 ? 'text-chart-green' : 'text-chart-red'}`}>
                  ${s.pnl.toFixed(0)}
                </span>
                <div className={`px-3 py-1 rounded font-mono font-bold text-xs ${getColor(s.avgRR)}`}>
                  {s.avgRR.toFixed(2)}R
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
