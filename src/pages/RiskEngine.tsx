import { useTrades } from '@/hooks/useTrades';
import { computeFullAnalytics } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, LineChart, Line, AreaChart, Area
} from 'recharts';
import { format, parseISO, getDay } from 'date-fns';

export default function RiskEngine() {
  const { data: trades } = useTrades();
  const analytics = computeFullAnalytics(trades ?? []);
  const totalMetrics = analytics.reduce((s, c) => s + c.metrics.length, 0);

  const closed = (trades ?? []).filter(t => t.status === 'closed' && t.pnl !== null)
    .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

  // Equity curve
  let cumPnl = 0;
  const equityData = closed.map(t => {
    cumPnl += t.pnl ?? 0;
    return { date: format(parseISO(t.entry_date), 'MMM dd'), equity: cumPnl };
  });

  // Drawdown
  let peak = 0;
  const ddData = equityData.map(d => {
    if (d.equity > peak) peak = d.equity;
    return { date: d.date, drawdown: peak > 0 ? -((peak - d.equity) / peak) * 100 : 0 };
  });

  // P&L distribution histogram
  const pnls = closed.map(t => t.pnl ?? 0);
  const buckets = 20;
  const minPnl = Math.min(...pnls, 0);
  const maxPnl = Math.max(...pnls, 0);
  const range = maxPnl - minPnl || 1;
  const histData: { bucket: string; count: number; midVal: number }[] = [];
  for (let i = 0; i < buckets; i++) {
    const lo = minPnl + (range / buckets) * i;
    const hi = minPnl + (range / buckets) * (i + 1);
    const count = pnls.filter(p => p >= lo && (i === buckets - 1 ? p <= hi : p < hi)).length;
    histData.push({ bucket: `$${lo.toFixed(0)}`, count, midVal: (lo + hi) / 2 });
  }

  // By day of week
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const byDayData = dayNames.map((name, i) => {
    const dayTrades = closed.filter(t => getDay(parseISO(t.entry_date)) === i);
    return { day: name, pnl: dayTrades.reduce((s, t) => s + (t.pnl ?? 0), 0), trades: dayTrades.length };
  }).filter(d => d.trades > 0);

  // Win rate by strategy pie
  const strategies = [...new Set(closed.map(t => t.strategy).filter(Boolean))];
  const stratPieData = strategies.map((s, i) => {
    const st = closed.filter(t => t.strategy === s);
    return { name: s!, value: st.length, color: `hsl(${(i * 60) % 360}, 70%, 50%)` };
  });

  const tooltipStyle = { background: 'hsl(220, 18%, 8%)', border: '1px solid hsl(220, 13%, 14%)', borderRadius: 8 };

  const handleExport = async () => {
    const { downloadAnalyticsZip } = await import('@/lib/analytics');
    downloadAnalyticsZip(analytics);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quantitative Risk Engine</h1>
          <p className="text-muted-foreground text-sm">{totalMetrics} analytics metrics</p>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />Export Analytics
        </Button>
      </div>

      {/* Visual Charts */}
      {closed.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Equity Curve */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Equity Curve</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 14%)" />
                <XAxis dataKey="date" stroke="hsl(215, 16%, 52%)" fontSize={10} />
                <YAxis stroke="hsl(215, 16%, 52%)" fontSize={10} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Equity']} />
                <Area type="monotone" dataKey="equity" stroke="hsl(142, 71%, 45%)" strokeWidth={2} fill="url(#eqGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Drawdown */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Drawdown %</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={ddData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 14%)" />
                <XAxis dataKey="date" stroke="hsl(215, 16%, 52%)" fontSize={10} />
                <YAxis stroke="hsl(215, 16%, 52%)" fontSize={10} tickFormatter={v => `${v.toFixed(0)}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}%`, 'DD']} />
                <Area type="monotone" dataKey="drawdown" stroke="hsl(0, 72%, 51%)" fill="hsl(0, 72%, 51%)" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* P&L Distribution */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">P&L Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={histData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 14%)" />
                <XAxis dataKey="bucket" stroke="hsl(215, 16%, 52%)" fontSize={9} />
                <YAxis stroke="hsl(215, 16%, 52%)" fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {histData.map((entry, i) => <Cell key={i} fill={entry.midVal >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 72%, 51%)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By Day of Week */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">P&L by Day of Week</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byDayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 14%)" />
                <XAxis dataKey="day" stroke="hsl(215, 16%, 52%)" fontSize={11} />
                <YAxis stroke="hsl(215, 16%, 52%)" fontSize={10} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {byDayData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 72%, 51%)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Strategy Pie */}
          {stratPieData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Trades by Strategy</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={stratPieData} dataKey="value" innerRadius={50} outerRadius={90} paddingAngle={3}>
                    {stratPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Metric Tables */}
      {analytics.map(cat => (
        <div key={cat.category} className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">{cat.category}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {cat.metrics.map((m, i) => (
              <div key={i} className="bg-secondary rounded-lg p-3 group relative">
                <p className="text-[10px] text-muted-foreground uppercase truncate">{m.name}</p>
                <p className="font-mono font-bold text-sm truncate">{m.value}</p>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-border">
                  {m.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
