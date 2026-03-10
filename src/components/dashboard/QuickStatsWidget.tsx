import { useMemo } from 'react';
import { Zap, BarChart3, Target, TrendingUp, TrendingDown } from 'lucide-react';

interface QuickStatsWidgetProps {
  trades: any[] | undefined;
}

export function QuickStatsWidget({ trades }: QuickStatsWidgetProps) {
  const stats = useMemo(() => {
    if (!trades || trades.length === 0) return null;
    const closed = trades.filter(t => t.status === 'closed' && t.pnl !== null);
    if (closed.length === 0) return null;

    const today = new Date().toISOString().slice(0, 10);
    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    const weekStr = thisWeekStart.toISOString().slice(0, 10);

    const todayTrades = closed.filter(t => t.entry_date?.slice(0, 10) === today);
    const weekTrades = closed.filter(t => t.entry_date?.slice(0, 10) >= weekStr);

    const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const weekPnl = weekTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const wins = closed.filter(t => (t.pnl ?? 0) > 0).length;
    const winRate = (wins / closed.length * 100);

    let streak = 0;
    const sorted = [...closed].sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
    if (sorted.length > 0) {
      const firstWin = (sorted[0].pnl ?? 0) > 0;
      for (const t of sorted) {
        if (((t.pnl ?? 0) > 0) === firstWin) streak++;
        else break;
      }
      if (!firstWin) streak = -streak;
    }

    const symMap: Record<string, number> = {};
    weekTrades.forEach(t => { symMap[t.symbol] = (symMap[t.symbol] ?? 0) + (t.pnl ?? 0); });
    const bestSym = Object.entries(symMap).sort((a, b) => b[1] - a[1])[0];

    return { todayPnl, todayCount: todayTrades.length, weekPnl, weekCount: weekTrades.length, winRate, totalCount: closed.length, streak, bestSym };
  }, [trades]);

  if (!stats) return null;

  const items = [
    { icon: Zap, label: 'TODAY', value: `$${stats.todayPnl.toFixed(0)}`, sub: `trades ${stats.todayCount}`, positive: stats.todayPnl >= 0 },
    { icon: BarChart3, label: 'THIS WEEK', value: `$${stats.weekPnl.toFixed(0)}`, sub: `trades ${stats.weekCount}`, positive: stats.weekPnl >= 0 },
    { icon: Target, label: 'WIN RATE', value: `${stats.winRate.toFixed(1)}%`, sub: `total ${stats.totalCount}`, positive: stats.winRate >= 50 },
    { icon: stats.streak >= 0 ? TrendingUp : TrendingDown, label: 'STREAK', value: `${stats.streak >= 0 ? 'W' : 'L'}  ${Math.abs(stats.streak)}`, sub: 'current', positive: stats.streak >= 0 },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-end gap-2 mb-3">
        <span className="text-sm font-semibold text-muted-foreground">Quick Stats</span>
        <Zap className="h-4 w-4 text-primary" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map(item => (
          <div key={item.label} className="rounded-xl border border-border bg-background p-4 text-center space-y-1.5">
            <item.icon className={`h-4 w-4 mx-auto ${item.positive ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`} />
            <p className={`text-xl font-mono font-bold ${item.positive ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>{item.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium tracking-wider">{item.label}</p>
            <p className="text-[10px] text-muted-foreground">{item.sub}</p>
          </div>
        ))}
      </div>
      {stats.bestSym && (
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Best symbol this week: <span className="font-mono font-bold text-foreground">{stats.bestSym[0]}</span> ({stats.bestSym[1] >= 0 ? '+' : ''}{stats.bestSym[1].toFixed(0)}$) 🏆
        </p>
      )}
    </div>
  );
}
