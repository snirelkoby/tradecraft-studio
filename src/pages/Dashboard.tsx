import { useState, useEffect } from 'react';
import { useTrades, useTradeStats } from '@/hooks/useTrades';
import { KpiCard } from '@/components/KpiCard';
import { computeFullAnalytics } from '@/lib/analytics';
import {
  Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings2 } from 'lucide-react';

const ALL_WIDGETS = [
  { id: 'kpi-main', label: 'Main KPIs (P&L, Win Rate, PF, Total)' },
  { id: 'kpi-secondary', label: 'Secondary KPIs (Avg Win/Loss, Best/Worst)' },
  { id: 'cum-pnl', label: 'Cumulative P&L Chart' },
  { id: 'win-loss-pie', label: 'Win/Loss Pie' },
  { id: 'daily-bar', label: 'Daily P&L Bar Chart' },
  { id: 'equity-curve', label: 'Equity Curve' },
  { id: 'by-strategy', label: 'P&L by Strategy' },
  { id: 'by-symbol', label: 'P&L by Symbol' },
  { id: 'risk-metrics', label: 'Risk Metrics (Sharpe, Sortino, DD)' },
  { id: 'streak', label: 'Streak Analysis' },
] as const;

type WidgetId = typeof ALL_WIDGETS[number]['id'];
const DEFAULT_WIDGETS: WidgetId[] = ['kpi-main', 'kpi-secondary', 'cum-pnl', 'win-loss-pie', 'daily-bar'];
const STORAGE_KEY = 'dashboard-widgets';

export default function Dashboard() {
  const { data: trades, isLoading } = useTrades();
  const stats = useTradeStats(trades);
  const analytics = computeFullAnalytics(trades ?? []);

  const [activeWidgets, setActiveWidgets] = useState<WidgetId[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_WIDGETS;
    } catch { return DEFAULT_WIDGETS; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activeWidgets));
  }, [activeWidgets]);

  const toggleWidget = (id: WidgetId) => {
    setActiveWidgets(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  const closed = (trades ?? [])
    .filter((t) => t.status === 'closed' && t.pnl !== null)
    .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

  let cumPnl = 0;
  const cumData = closed.map((t) => {
    cumPnl += t.pnl ?? 0;
    return { date: format(parseISO(t.entry_date), 'MMM dd'), pnl: cumPnl };
  });

  const dailyMap = new Map<string, number>();
  closed.forEach((t) => {
    const d = format(parseISO(t.entry_date), 'MMM dd');
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + (t.pnl ?? 0));
  });
  const dailyData = Array.from(dailyMap.entries()).map(([date, pnl]) => ({ date, pnl }));

  const pieData = [
    { name: 'Wins', value: stats.wins, color: 'hsl(142, 71%, 45%)' },
    { name: 'Losses', value: stats.losses, color: 'hsl(0, 72%, 51%)' },
  ];

  // Strategy breakdown
  const strategyData = [...new Set(closed.map(t => t.strategy).filter(Boolean))].map(s => {
    const st = closed.filter(t => t.strategy === s);
    return { strategy: s!, pnl: st.reduce((sum, t) => sum + (t.pnl ?? 0), 0), trades: st.length };
  });

  // Symbol breakdown
  const symbolData = [...new Set(closed.map(t => t.symbol))].map(sym => {
    const st = closed.filter(t => t.symbol === sym);
    return { symbol: sym, pnl: st.reduce((sum, t) => sum + (t.pnl ?? 0), 0), trades: st.length };
  }).sort((a, b) => b.pnl - a.pnl).slice(0, 10);

  const riskCat = analytics.find(a => a.category === 'Risk Metrics');
  const streakCat = analytics.find(a => a.category === 'Streak Analysis');

  const has = (id: WidgetId) => activeWidgets.includes(id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of your trading performance</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm"><Settings2 className="h-4 w-4 mr-2" />Customize</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Dashboard Widgets</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {ALL_WIDGETS.map(w => (
                <label key={w.id} className="flex items-center gap-3 cursor-pointer">
                  <Checkbox checked={activeWidgets.includes(w.id)} onCheckedChange={() => toggleWidget(w.id)} />
                  <span className="text-sm">{w.label}</span>
                </label>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {has('kpi-main') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Total P&L" value={`$${stats.totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} variant={stats.totalPnl >= 0 ? 'green' : 'red'} />
          <KpiCard title="Win Rate" value={`${stats.winRate.toFixed(1)}%`} subtitle={`${stats.wins}W / ${stats.losses}L`} variant={stats.winRate >= 50 ? 'green' : 'red'} />
          <KpiCard title="Profit Factor" value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)} variant={stats.profitFactor >= 1 ? 'green' : 'red'} />
          <KpiCard title="Total Trades" value={stats.totalTrades.toString()} variant="blue" />
        </div>
      )}

      {has('kpi-secondary') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Avg Win" value={`$${stats.avgWin.toFixed(2)}`} variant="green" />
          <KpiCard title="Avg Loss" value={`-$${stats.avgLoss.toFixed(2)}`} variant="red" />
          <KpiCard title="Best Trade" value={`$${stats.bestTrade.toFixed(2)}`} variant="green" />
          <KpiCard title="Worst Trade" value={`$${stats.worstTrade.toFixed(2)}`} variant="red" />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {has('cum-pnl') && (
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
                  <Tooltip contentStyle={{ background: 'hsl(220, 18%, 8%)', border: '1px solid hsl(220, 13%, 14%)', borderRadius: 8 }} formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']} />
                  <Area type="monotone" dataKey="pnl" stroke="hsl(217, 91%, 60%)" strokeWidth={2} fill="url(#pnlGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-12">No closed trades yet</p>}
          </div>
        )}

        {has('win-loss-pie') && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Win / Loss</h3>
            {stats.totalTrades > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={60} outerRadius={100} paddingAngle={4}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(220, 18%, 8%)', border: '1px solid hsl(220, 13%, 14%)', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-12">No data</p>}
          </div>
        )}
      </div>

      {has('daily-bar') && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Daily P&L</h3>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 14%)" />
                <XAxis dataKey="date" stroke="hsl(215, 16%, 52%)" fontSize={11} />
                <YAxis stroke="hsl(215, 16%, 52%)" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ background: 'hsl(220, 18%, 8%)', border: '1px solid hsl(220, 13%, 14%)', borderRadius: 8 }} formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {dailyData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 72%, 51%)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-muted-foreground text-sm text-center py-12">No data</p>}
        </div>
      )}

      {has('equity-curve') && cumData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Equity Curve</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={cumData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 14%)" />
              <XAxis dataKey="date" stroke="hsl(215, 16%, 52%)" fontSize={11} />
              <YAxis stroke="hsl(215, 16%, 52%)" fontSize={11} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ background: 'hsl(220, 18%, 8%)', border: '1px solid hsl(220, 13%, 14%)', borderRadius: 8 }} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Equity']} />
              <Line type="monotone" dataKey="pnl" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {has('by-strategy') && strategyData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">P&L by Strategy</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={strategyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 14%)" />
              <XAxis dataKey="strategy" stroke="hsl(215, 16%, 52%)" fontSize={11} />
              <YAxis stroke="hsl(215, 16%, 52%)" fontSize={11} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ background: 'hsl(220, 18%, 8%)', border: '1px solid hsl(220, 13%, 14%)', borderRadius: 8 }} formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {strategyData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 72%, 51%)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {has('by-symbol') && symbolData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">P&L by Symbol (Top 10)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={symbolData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 14%)" />
              <XAxis type="number" stroke="hsl(215, 16%, 52%)" fontSize={11} tickFormatter={(v) => `$${v}`} />
              <YAxis type="category" dataKey="symbol" stroke="hsl(215, 16%, 52%)" fontSize={11} width={60} />
              <Tooltip contentStyle={{ background: 'hsl(220, 18%, 8%)', border: '1px solid hsl(220, 13%, 14%)', borderRadius: 8 }} formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']} />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                {symbolData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 72%, 51%)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {has('risk-metrics') && riskCat && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Risk Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {riskCat.metrics.slice(0, 10).map((m, i) => (
              <div key={i} className="bg-secondary rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase truncate">{m.name}</p>
                <p className="font-mono font-bold text-sm truncate">{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {has('streak') && streakCat && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Streak Analysis</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {streakCat.metrics.map((m, i) => (
              <div key={i} className="bg-secondary rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase truncate">{m.name}</p>
                <p className="font-mono font-bold text-sm truncate">{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
