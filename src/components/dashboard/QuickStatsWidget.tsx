import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Target, Clock, Zap, BarChart3 } from 'lucide-react';

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
    const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const wins = closed.filter(t => (t.pnl ?? 0) > 0).length;
    const winRate = (wins / closed.length * 100);

    // Current streak
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

    // Best symbol this week
    const symMap: Record<string, number> = {};
    weekTrades.forEach(t => { symMap[t.symbol] = (symMap[t.symbol] ?? 0) + (t.pnl ?? 0); });
    const bestSym = Object.entries(symMap).sort((a, b) => b[1] - a[1])[0];

    return { todayPnl, todayCount: todayTrades.length, weekPnl, weekCount: weekTrades.length, totalPnl, winRate, totalCount: closed.length, streak, bestSym };
  }, [trades]);

  if (!stats) return null;

  const items = [
    { icon: Zap, label: 'Today', value: `$${stats.todayPnl.toFixed(0)}`, sub: `${stats.todayCount} trades`, positive: stats.todayPnl >= 0 },
    { icon: BarChart3, label: 'This Week', value: `$${stats.weekPnl.toFixed(0)}`, sub: `${stats.weekCount} trades`, positive: stats.weekPnl >= 0 },
    { icon: Target, label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, sub: `${stats.totalCount} total`, positive: stats.winRate >= 50 },
    { icon: stats.streak >= 0 ? TrendingUp : TrendingDown, label: 'Streak', value: `${Math.abs(stats.streak)} ${stats.streak >= 0 ? 'W' : 'L'}`, sub: 'current', positive: stats.streak >= 0 },
  ];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Quick Stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {items.map(item => (
            <div key={item.label} className="text-center space-y-1 p-2 rounded-lg bg-muted/30">
              <item.icon className={`h-4 w-4 mx-auto ${item.positive ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`} />
              <p className={`text-lg font-mono font-bold ${item.positive ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>{item.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
              <p className="text-[10px] text-muted-foreground">{item.sub}</p>
            </div>
          ))}
        </div>
        {stats.bestSym && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            🏆 Best symbol this week: <span className="font-mono font-medium text-foreground">{stats.bestSym[0]}</span> ({stats.bestSym[1] >= 0 ? '+' : ''}{stats.bestSym[1].toFixed(0)}$)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
