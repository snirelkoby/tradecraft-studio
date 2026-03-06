import { useTrades, useTradeStats } from '@/hooks/useTrades';
import { KpiCard } from '@/components/KpiCard';
import {
  Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { format, parseISO } from 'date-fns';

export default function Dashboard() {
  const { data: trades, isLoading } = useTrades();
  const stats = useTradeStats(trades);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  // Cumulative PnL data
  const closed = (trades ?? [])
    .filter((t) => t.status === 'closed' && t.pnl !== null)
    .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

  let cumPnl = 0;
  const cumData = closed.map((t) => {
    cumPnl += t.pnl ?? 0;
    return { date: format(parseISO(t.entry_date), 'MMM dd'), pnl: cumPnl };
  });

  // Daily PnL for bar chart
  const dailyMap = new Map<string, number>();
  closed.forEach((t) => {
    const d = format(parseISO(t.entry_date), 'MMM dd');
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + (t.pnl ?? 0));
  });
  const dailyData = Array.from(dailyMap.entries()).map(([date, pnl]) => ({ date, pnl }));

  // Win/Loss pie
  const pieData = [
    { name: 'Wins', value: stats.wins, color: 'hsl(142, 71%, 45%)' },
    { name: 'Losses', value: stats.losses, color: 'hsl(0, 72%, 51%)' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Performance Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your trading performance</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Total P&L"
          value={`$${stats.totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          variant={stats.totalPnl >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          title="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          subtitle={`${stats.wins}W / ${stats.losses}L`}
          variant={stats.winRate >= 50 ? 'green' : 'red'}
        />
        <KpiCard
          title="Profit Factor"
          value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
          variant={stats.profitFactor >= 1 ? 'green' : 'red'}
        />
        <KpiCard
          title="Total Trades"
          value={stats.totalTrades.toString()}
          variant="blue"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Avg Win" value={`$${stats.avgWin.toFixed(2)}`} variant="green" />
        <KpiCard title="Avg Loss" value={`-$${stats.avgLoss.toFixed(2)}`} variant="red" />
        <KpiCard title="Best Trade" value={`$${stats.bestTrade.toFixed(2)}`} variant="green" />
        <KpiCard title="Worst Trade" value={`$${stats.worstTrade.toFixed(2)}`} variant="red" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Cumulative PnL */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Cumulative P&L</h3>
          {cumData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cumData}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 14%)" />
                <XAxis dataKey="date" stroke="hsl(215, 16%, 52%)" fontSize={11} />
                <YAxis stroke="hsl(215, 16%, 52%)" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(220, 18%, 8%)', border: '1px solid hsl(220, 13%, 14%)', borderRadius: 8 }}
                  labelStyle={{ color: 'hsl(210, 40%, 96%)' }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']}
                />
                <Area type="monotone" dataKey="pnl" stroke="hsl(217, 91%, 60%)" strokeWidth={2} fill="url(#pnlGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-12">No closed trades yet</p>
          )}
        </div>

        {/* Win/Loss Pie */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Win / Loss</h3>
          {stats.totalTrades > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={60} outerRadius={100} paddingAngle={4}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'hsl(220, 18%, 8%)', border: '1px solid hsl(220, 13%, 14%)', borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-12">No data</p>
          )}
        </div>
      </div>

      {/* Daily PnL Bar Chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Daily P&L</h3>
        {dailyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 14%)" />
              <XAxis dataKey="date" stroke="hsl(215, 16%, 52%)" fontSize={11} />
              <YAxis stroke="hsl(215, 16%, 52%)" fontSize={11} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: 'hsl(220, 18%, 8%)', border: '1px solid hsl(220, 13%, 14%)', borderRadius: 8 }}
                formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {dailyData.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 72%, 51%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-12">No data</p>
        )}
      </div>
    </div>
  );
}
