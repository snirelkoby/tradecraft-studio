import { useState, useEffect, useMemo } from 'react';
import { useTrades, useTradeStats } from '@/hooks/useTrades';
import { useSelectedAccount } from '@/hooks/useSelectedAccount';
import { KpiCard } from '@/components/KpiCard';
import { computeFullAnalytics } from '@/lib/analytics';
import { HourlyPnlChart } from '@/components/dashboard/HourlyPnlChart';
import { TradeCandlestickChart } from '@/components/dashboard/TradeCandlestickChart';
import { DayOfWeekChart } from '@/components/dashboard/DayOfWeekChart';
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
  { id: 'hourly-pnl', label: 'P&L by Hour' },
  { id: 'trade-candles', label: 'Daily Candles (High/Low/Close)' },
  { id: 'day-of-week', label: 'P&L by Day of Week' },
] as const;

type WidgetId = typeof ALL_WIDGETS[number]['id'];
const DEFAULT_WIDGETS: WidgetId[] = ['kpi-main', 'kpi-secondary', 'cum-pnl', 'win-loss-pie', 'daily-bar', 'hourly-pnl', 'trade-candles'];
const STORAGE_KEY = 'dashboard-widgets';

export default function Dashboard() {
  const { data: allTrades, isLoading } = useTrades();
  const { selectedAccount } = useSelectedAccount();

  const trades = useMemo(() => {
    if (!allTrades) return undefined;
    if (selectedAccount === 'all') return allTrades;
    return allTrades.filter(t => t.account_name === selectedAccount);
  }, [allTrades, selectedAccount]);

  const stats = useTradeStats(trades);
  const analytics = computeFullAnalytics(trades ?? []);

  const [activeWidgets, setActiveWidgets] = useState<WidgetId[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_WIDGETS;
    } catch { return DEFAULT_WIDGETS; }
  });

  const [cumMode, setCumMode] = useState<'trade' | 'day'>('trade');

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

  // Per-trade cumulative
  let cumPnl = 0;
  const cumDataPerTrade = closed.map((t, i) => {
    cumPnl += t.pnl ?? 0;
    return { label: `#${i + 1}`, date: format(parseISO(t.entry_date), 'MMM dd'), pnl: cumPnl };
  });

  // Per-day cumulative
  const dailyCumMap = new Map<string, number>();
  closed.forEach((t) => {
    const d = format(parseISO(t.entry_date), 'yyyy-MM-dd');
    dailyCumMap.set(d, (dailyCumMap.get(d) ?? 0) + (t.pnl ?? 0));
  });
  let dayCum = 0;
  const cumDataPerDay = Array.from(dailyCumMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => {
      dayCum += pnl;
      return { label: format(parseISO(date), 'MMM dd'), date: format(parseISO(date), 'MMM dd'), pnl: dayCum };
    });

  const cumData = cumMode === 'trade' ? cumDataPerTrade : cumDataPerDay;
  const cumData = cumMode === 'trade' ? cumDataPerTrade : cumDataPerDay;

  const dailyMap = new Map<string, number>();
  closed.forEach((t) => {
    const d = format(parseISO(t.entry_date), 'MMM dd');
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + (t.pnl ?? 0));
  });
  const dailyData = Array.from(dailyMap.entries()).map(([date, pnl]) => ({ date, pnl }));

  const pieData = [
    { name: 'Wins', value: stats.wins, color: 'hsl(var(--chart-green))' },
    { name: 'Losses', value: stats.losses, color: 'hsl(var(--chart-red))' },
  ];

  const strategyData = [...new Set(closed.map(t => t.strategy).filter(Boolean))].map(s => {
    const st = closed.filter(t => t.strategy === s);
    return { strategy: s!, pnl: st.reduce((sum, t) => sum + (t.pnl ?? 0), 0), trades: st.length };
  });

  const symbolData = [...new Set(closed.map(t => t.symbol))].map(sym => {
    const st = closed.filter(t => t.symbol === sym);
    return { symbol: sym, pnl: st.reduce((sum, t) => sum + (t.pnl ?? 0), 0), trades: st.length };
  }).sort((a, b) => b.pnl - a.pnl).slice(0, 10);

  const riskCat = analytics.find(a => a.category === 'Risk Metrics');
  const streakCat = analytics.find(a => a.category === 'Streak Analysis');

  const has = (id: WidgetId) => activeWidgets.includes(id);

  const tooltipStyle = {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    color: 'hsl(var(--foreground))',
  };

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
                      <stop offset="0%" stopColor="hsl(var(--chart-blue))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--chart-blue))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v}`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']} />
                  <Area type="monotone" dataKey="pnl" stroke="hsl(var(--chart-blue))" strokeWidth={2} fill="url(#pnlGrad)" />
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
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-12">No data</p>}
          </div>
        )}
      </div>

      {has('trade-candles') && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Daily Trade Candles</h3>
          <p className="text-xs text-muted-foreground mb-3">Each candle shows the day's P&L range: bar = close, dots = high (green) & low (red)</p>
          <TradeCandlestickChart trades={trades ?? []} />
        </div>
      )}

      {has('hourly-pnl') && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">P&L by Hour</h3>
          <HourlyPnlChart trades={trades ?? []} />
        </div>
      )}

      {has('day-of-week') && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">P&L by Day of Week</h3>
          <DayOfWeekChart trades={trades ?? []} />
        </div>
      )}

      {has('daily-bar') && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Daily P&L</h3>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {dailyData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))'} />)}
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
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Equity']} />
              <Line type="monotone" dataKey="pnl" stroke="hsl(var(--chart-green))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {has('by-strategy') && strategyData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">P&L by Strategy</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={strategyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="strategy" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {strategyData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))'} />)}
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
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v}`} />
              <YAxis type="category" dataKey="symbol" stroke="hsl(var(--muted-foreground))" fontSize={11} width={60} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']} />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                {symbolData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))'} />)}
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
