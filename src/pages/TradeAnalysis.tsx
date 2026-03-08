import { useState, useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell, AreaChart, Area, LineChart, BarChart
} from 'recharts';
import type { Database } from '@/integrations/supabase/types';

type Trade = Database['public']['Tables']['trades']['Row'];

const VIEWS = [
  { id: 'trade-candles', label: 'Trade Analysis' },
  { id: 'equity-curve', label: 'Equity Curve' },
  { id: 'long-equity', label: 'Long Equity' },
  { id: 'short-equity', label: 'Short Equity' },
  { id: 'drawdown', label: 'Drawdown' },
  { id: 'equity-dd', label: 'Equity + Drawdown' },
  { id: 'daily-pl', label: 'Daily PL' },
] as const;

type ViewId = typeof VIEWS[number]['id'];

export default function TradeAnalysis() {
  const { data: trades, isLoading } = useTrades();
  const [activeView, setActiveView] = useState<ViewId>('trade-candles');
  const [mode, setMode] = useState<'per-trade' | 'daily'>('per-trade');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const closed = useMemo(() => {
    return (trades ?? [])
      .filter(t => t.status === 'closed' && t.pnl !== null)
      .filter(t => {
        if (dateFrom && isBefore(parseISO(t.entry_date), parseISO(dateFrom))) return false;
        if (dateTo && isAfter(parseISO(t.entry_date), parseISO(dateTo + 'T23:59:59'))) return false;
        return true;
      })
      .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
  }, [trades, dateFrom, dateTo]);

  // Per-trade candle data: each trade is a candle
  // open=0, close=pnl, high=max(0, pnl), low=min(0, pnl)
  const perTradeCandles = useMemo(() => {
    return closed.map((t, i) => {
      const pnl = t.pnl ?? 0;
      return {
        label: `#${i + 1}`,
        time: format(parseISO(t.entry_date), 'HH:mm'),
        date: format(parseISO(t.entry_date), 'MM/dd'),
        fullDate: format(parseISO(t.entry_date), 'MMM dd HH:mm'),
        symbol: t.symbol,
        open: 0,
        close: pnl,
        high: Math.max(0, pnl),
        low: Math.min(0, pnl),
        isProfit: pnl >= 0,
        pnl,
        direction: t.direction,
      };
    });
  }, [closed]);

  // Daily candle data
  const dailyCandles = useMemo(() => {
    const dayMap = new Map<string, Trade[]>();
    closed.forEach(t => {
      const day = format(parseISO(t.entry_date), 'yyyy-MM-dd');
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(t);
    });

    const result: any[] = [];
    dayMap.forEach((dayTrades, day) => {
      dayTrades.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
      let running = 0, high = 0, low = 0;
      dayTrades.forEach(t => {
        running += t.pnl ?? 0;
        if (running > high) high = running;
        if (running < low) low = running;
      });
      result.push({
        label: format(parseISO(day), 'MM/dd'),
        fullDate: format(parseISO(day), 'MMM dd'),
        open: 0,
        close: running,
        high,
        low,
        isProfit: running >= 0,
        pnl: running,
        trades: dayTrades.length,
      });
    });
    return result;
  }, [closed]);

  const candleData = mode === 'per-trade' ? perTradeCandles : dailyCandles;

  // Equity curve data
  const equityData = useMemo(() => {
    let cum = 0;
    return closed.map((t, i) => {
      cum += t.pnl ?? 0;
      return {
        label: mode === 'per-trade' ? `#${i + 1}` : format(parseISO(t.entry_date), 'MM/dd'),
        fullDate: format(parseISO(t.entry_date), 'MMM dd HH:mm'),
        equity: cum,
        pnl: t.pnl ?? 0,
      };
    });
  }, [closed, mode]);

  // Long/Short equity
  const longEquityData = useMemo(() => {
    let cum = 0;
    return closed.filter(t => t.direction === 'long').map((t, i) => {
      cum += t.pnl ?? 0;
      return { label: `#${i + 1}`, equity: cum, fullDate: format(parseISO(t.entry_date), 'MMM dd HH:mm') };
    });
  }, [closed]);

  const shortEquityData = useMemo(() => {
    let cum = 0;
    return closed.filter(t => t.direction === 'short').map((t, i) => {
      cum += t.pnl ?? 0;
      return { label: `#${i + 1}`, equity: cum, fullDate: format(parseISO(t.entry_date), 'MMM dd HH:mm') };
    });
  }, [closed]);

  // Drawdown data
  const drawdownData = useMemo(() => {
    let cum = 0, peak = 0;
    return closed.map((t, i) => {
      cum += t.pnl ?? 0;
      if (cum > peak) peak = cum;
      const dd = peak > 0 ? ((cum - peak) / peak) * 100 : cum < 0 ? cum : 0;
      return {
        label: `#${i + 1}`,
        fullDate: format(parseISO(t.entry_date), 'MMM dd HH:mm'),
        drawdown: dd,
        equity: cum,
      };
    });
  }, [closed]);

  // Daily P&L
  const dailyPLData = useMemo(() => {
    const dayMap = new Map<string, number>();
    closed.forEach(t => {
      const d = format(parseISO(t.entry_date), 'MM/dd');
      dayMap.set(d, (dayMap.get(d) ?? 0) + (t.pnl ?? 0));
    });
    return Array.from(dayMap.entries()).map(([date, pnl]) => ({ date, pnl }));
  }, [closed]);

  const tooltipStyle = {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    color: 'hsl(var(--foreground))',
  };

  const renderChart = () => {
    if (closed.length === 0) {
      return <p className="text-muted-foreground text-center py-20">No closed trades in selected range</p>;
    }

    switch (activeView) {
      case 'trade-candles':
        return (
          <ResponsiveContainer width="100%" height={450}>
            <ComposedChart data={candleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                interval={Math.max(0, Math.floor(candleData.length / 20))}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]}
                labelFormatter={(label) => {
                  const item = candleData.find(d => d.label === label);
                  return item?.fullDate ?? label;
                }}
              />
              {/* Candle bodies: bar from 0 to close */}
              <Bar dataKey="close" barSize={mode === 'per-trade' ? 8 : 20} radius={[2, 2, 2, 2]} name="P&L">
                {candleData.map((entry, i) => (
                  <Cell key={i} fill={entry.isProfit ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-purple, 262 83% 58%))'} />
                ))}
              </Bar>
              {/* High wick */}
              <Line type="monotone" dataKey="high" stroke="none" dot={{ r: 2, fill: 'hsl(var(--chart-green))' }} name="High" />
              {/* Low wick */}
              <Line type="monotone" dataKey="low" stroke="none" dot={{ r: 2, fill: 'hsl(var(--chart-purple, 262 83% 58%))' }} name="Low" />
            </ComposedChart>
          </ResponsiveContainer>
        );

      case 'equity-curve':
        return (
          <ResponsiveContainer width="100%" height={450}>
            <AreaChart data={equityData}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-blue))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--chart-blue))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={Math.max(0, Math.floor(equityData.length / 20))} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Equity']} />
              <Area type="monotone" dataKey="equity" stroke="hsl(var(--chart-blue))" strokeWidth={2} fill="url(#eqGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'long-equity':
        return (
          <ResponsiveContainer width="100%" height={450}>
            <AreaChart data={longEquityData}>
              <defs>
                <linearGradient id="longGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-green))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--chart-green))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Long Equity']} />
              <Area type="monotone" dataKey="equity" stroke="hsl(var(--chart-green))" strokeWidth={2} fill="url(#longGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'short-equity':
        return (
          <ResponsiveContainer width="100%" height={450}>
            <AreaChart data={shortEquityData}>
              <defs>
                <linearGradient id="shortGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-purple))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--chart-purple))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Short Equity']} />
              <Area type="monotone" dataKey="equity" stroke="hsl(var(--chart-purple))" strokeWidth={2} fill="url(#shortGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'drawdown':
        return (
          <ResponsiveContainer width="100%" height={450}>
            <AreaChart data={drawdownData}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-red))" stopOpacity={0} />
                  <stop offset="100%" stopColor="hsl(var(--chart-red))" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${v.toFixed(1)}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}%`, 'Drawdown']} />
              <Area type="monotone" dataKey="drawdown" stroke="hsl(var(--chart-red))" strokeWidth={2} fill="url(#ddGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'equity-dd':
        return (
          <ResponsiveContainer width="100%" height={450}>
            <ComposedChart data={drawdownData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis yAxisId="eq" stroke="hsl(var(--chart-blue))" fontSize={11} tickFormatter={v => `$${v}`} />
              <YAxis yAxisId="dd" orientation="right" stroke="hsl(var(--chart-red))" fontSize={11} tickFormatter={v => `${v.toFixed(0)}%`} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line yAxisId="eq" type="monotone" dataKey="equity" stroke="hsl(var(--chart-blue))" strokeWidth={2} dot={false} name="Equity ($)" />
              <Area yAxisId="dd" type="monotone" dataKey="drawdown" stroke="hsl(var(--chart-red))" fill="hsl(var(--chart-red) / 0.15)" strokeWidth={1} name="Drawdown (%)" />
            </ComposedChart>
          </ResponsiveContainer>
        );

      case 'daily-pl':
        return (
          <ResponsiveContainer width="100%" height={450}>
            <BarChart data={dailyPLData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {dailyPLData.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trade Analysis</h1>
        <p className="text-muted-foreground text-sm">Visual analysis of your trading performance</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left sidebar - view selector */}
        <div className="lg:w-56 flex-shrink-0 space-y-1">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={`w-full text-left text-sm px-4 py-2.5 rounded-lg transition-colors ${
                activeView === v.id
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Main chart area */}
        <div className="flex-1 rounded-xl border border-border bg-card p-5 space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {activeView === 'trade-candles' && (
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setMode('per-trade')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    mode === 'per-trade' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Per Trade
                </button>
                <button
                  onClick={() => setMode('daily')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    mode === 'daily' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Daily
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="bg-secondary text-xs w-36"
                placeholder="From"
              />
              <span className="text-muted-foreground text-xs">→</span>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="bg-secondary text-xs w-36"
                placeholder="To"
              />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="flex gap-4 text-xs">
            <span className="text-muted-foreground">
              Trades: <span className="text-foreground font-mono font-bold">{closed.length}</span>
            </span>
            <span className="text-muted-foreground">
              P&L: <span className={`font-mono font-bold ${closed.reduce((s, t) => s + (t.pnl ?? 0), 0) >= 0 ? 'text-chart-green' : 'text-chart-red'}`}>
                ${closed.reduce((s, t) => s + (t.pnl ?? 0), 0).toFixed(2)}
              </span>
            </span>
          </div>

          {renderChart()}
        </div>
      </div>
    </div>
  );
}
