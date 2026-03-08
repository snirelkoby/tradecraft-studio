import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { useAccounts } from '@/hooks/useAccounts';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell, AreaChart, Area, BarChart, Line,
  ReferenceLine
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
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

interface YahooResult { high: number; low: number; }

// Custom Bar shape that renders candle body + wicks
const CandleBarShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;

  const color = payload.isProfit ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-purple, 262 83% 58%))';
  const centerX = x + width / 2;
  const absHeight = Math.abs(height);
  const barTop = height >= 0 ? y : y + height;

  // If no wick data, render simple bar
  if (payload.wickHigh == null || payload.wickLow == null || payload.close === 0) {
    return (
      <g>
        <rect x={x} y={barTop} width={width} height={Math.max(absHeight, 2)} fill={color} rx={2} />
      </g>
    );
  }

  // Calculate wick positions proportionally
  // The bar spans from 0-line to close-value in pixels
  // pxPerDollar = absHeight / |close|
  const pxPerDollar = absHeight / Math.abs(payload.close);
  // zeroY is the pixel position of the $0 line
  const zeroY = payload.close >= 0 ? barTop + absHeight : barTop;

  const wickTopY = zeroY - Math.max(payload.wickHigh, 0) * pxPerDollar;
  const wickBottomY = zeroY + Math.abs(Math.min(payload.wickLow, 0)) * pxPerDollar;

  return (
    <g>
      {/* Wick line */}
      <line x1={centerX} y1={wickTopY} x2={centerX} y2={wickBottomY} stroke={color} strokeWidth={1.5} />
      {/* Candle body */}
      <rect x={x} y={barTop} width={width} height={Math.max(absHeight, 2)} fill={color} rx={2} />
    </g>
  );
};

export default function TradeAnalysis() {
  const { data: trades, isLoading } = useTrades();
  const { data: accounts } = useAccounts();
  const [activeView, setActiveView] = useState<ViewId>('trade-candles');
  const [mode, setMode] = useState<'per-trade' | 'daily'>('per-trade');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [yahooData, setYahooData] = useState<Record<string, YahooResult | null>>({});
  const [loadingYahoo, setLoadingYahoo] = useState(false);

  const closed = useMemo(() => {
    return (trades ?? [])
      .filter(t => t.status === 'closed' && t.pnl !== null)
      .filter(t => {
        if (selectedAccount !== 'all' && t.account_name !== selectedAccount) return false;
        if (dateFrom && isBefore(parseISO(t.entry_date), parseISO(dateFrom))) return false;
        if (dateTo && isAfter(parseISO(t.entry_date), parseISO(dateTo + 'T23:59:59'))) return false;
        return true;
      })
      .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
  }, [trades, dateFrom, dateTo, selectedAccount]);

  // Fetch Yahoo Finance data for per-trade mode
  useEffect(() => {
    if (mode !== 'per-trade' || closed.length === 0) return;

    const fetchYahoo = async () => {
      const symbols = closed
        .filter(t => t.exit_date)
        .map(t => ({
          key: t.id,
          symbol: t.symbol,
          startDate: t.entry_date,
          endDate: t.exit_date!,
        }));

      if (symbols.length === 0) return;
      const needed = symbols.filter(s => !(s.key in yahooData));
      if (needed.length === 0) return;

      setLoadingYahoo(true);
      try {
        for (let i = 0; i < needed.length; i += 20) {
          const batch = needed.slice(i, i + 20);
          const { data } = await supabase.functions.invoke('yahoo-finance', {
            body: { symbols: batch },
          });
          if (data?.results) {
            setYahooData(prev => ({ ...prev, ...data.results }));
          }
        }
      } catch (e) {
        console.error('Yahoo fetch error:', e);
      } finally {
        setLoadingYahoo(false);
      }
    };

    fetchYahoo();
  }, [closed, mode]);

  const calcPnlAtPrice = useCallback((trade: Trade, price: number): number => {
    const diff = trade.direction === 'long'
      ? price - trade.entry_price
      : trade.entry_price - price;
    return diff * trade.quantity - (trade.fees ?? 0);
  }, []);

  const perTradeCandles = useMemo(() => {
    return closed.map((t, i) => {
      const pnl = t.pnl ?? 0;
      const yahoo = yahooData[t.id];

      let wickHigh: number | null = null;
      let wickLow: number | null = null;

      if (yahoo) {
        const pnlAtHigh = calcPnlAtPrice(t, yahoo.high);
        const pnlAtLow = calcPnlAtPrice(t, yahoo.low);
        wickHigh = Math.max(pnlAtHigh, pnlAtLow, pnl, 0);
        wickLow = Math.min(pnlAtHigh, pnlAtLow, pnl, 0);
      }

      return {
        label: `#${i + 1}`,
        date: format(parseISO(t.entry_date), 'MM/dd'),
        fullDate: format(parseISO(t.entry_date), 'MMM dd HH:mm'),
        symbol: t.symbol,
        open: 0,
        close: pnl,
        wickHigh,
        wickLow,
        isProfit: pnl >= 0,
        pnl,
        direction: t.direction,
      };
    });
  }, [closed, yahooData, calcPnlAtPrice]);

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
        wickHigh: high,
        wickLow: low,
        isProfit: running >= 0,
        pnl: running,
        trades: dayTrades.length,
      });
    });
    return result;
  }, [closed]);

  const candleData = mode === 'per-trade' ? perTradeCandles : dailyCandles;

  const equityData = useMemo(() => {
    let cum = 0;
    return closed.map((t, i) => {
      cum += t.pnl ?? 0;
      return {
        label: mode === 'per-trade' ? `#${i + 1}` : format(parseISO(t.entry_date), 'MM/dd'),
        fullDate: format(parseISO(t.entry_date), 'MMM dd HH:mm'),
        equity: cum,
      };
    });
  }, [closed, mode]);

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

  const CandleTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div className="rounded-lg border border-border bg-popover p-3 text-xs space-y-1 shadow-lg">
        <p className="font-semibold text-foreground">{d.fullDate ?? label}</p>
        {d.symbol && <p className="text-muted-foreground">{d.symbol} · {d.direction}</p>}
        <p>P&L: <span className={d.isProfit ? 'text-chart-green' : 'text-chart-red'}>${d.pnl?.toFixed(2)}</span></p>
        {d.wickHigh != null && <p className="text-chart-green">Max P&L: ${d.wickHigh.toFixed(2)}</p>}
        {d.wickLow != null && <p className="text-chart-red">Min P&L: ${d.wickLow.toFixed(2)}</p>}
        {d.trades && <p className="text-muted-foreground">{d.trades} trades</p>}
      </div>
    );
  };

  const renderCandlestickChart = () => {
    if (candleData.length === 0) {
      return <p className="text-muted-foreground text-center py-20">No closed trades in selected range</p>;
    }

    // Calculate Y domain including wicks
    const allValues = candleData.flatMap(d => [
      d.close, 0,
      d.wickHigh ?? d.close,
      d.wickLow ?? d.close,
    ]);
    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    const padding = Math.max(Math.abs(dataMax - dataMin) * 0.1, 10);

    return (
      <ResponsiveContainer width="100%" height={450}>
        <ComposedChart data={candleData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            interval={Math.max(0, Math.floor(candleData.length / 20))}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickFormatter={v => `$${v}`}
            domain={[dataMin - padding, dataMax + padding]}
          />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Tooltip content={<CandleTooltip />} />
          {/* Candle bodies with wicks via custom shape */}
          <Bar dataKey="close" barSize={mode === 'per-trade' ? 8 : 20} name="P&L" shape={<CandleBarShape />}>
            {candleData.map((entry, i) => (
              <Cell key={i} fill={entry.isProfit ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-purple, 262 83% 58%))'} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  const renderChart = () => {
    if (closed.length === 0) {
      return <p className="text-muted-foreground text-center py-20">No closed trades in selected range</p>;
    }

    switch (activeView) {
      case 'trade-candles':
        return renderCandlestickChart();

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

  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trade Analysis</h1>
        <p className="text-muted-foreground text-sm">Visual analysis of your trading performance</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left sidebar */}
        <div className="lg:w-56 flex-shrink-0 space-y-3">
          {/* Account selector */}
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-full bg-secondary text-sm">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts?.map(a => (
                <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="space-y-1">
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
            {loadingYahoo && mode === 'per-trade' && activeView === 'trade-candles' && (
              <span className="text-xs text-muted-foreground animate-pulse">Loading market data...</span>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-secondary text-xs w-36" />
              <span className="text-muted-foreground text-xs">→</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-secondary text-xs w-36" />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</Button>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="flex gap-4 text-xs">
            <span className="text-muted-foreground">
              Trades: <span className="text-foreground font-mono font-bold">{closed.length}</span>
            </span>
            <span className="text-muted-foreground">
              P&L: <span className={`font-mono font-bold ${totalPnl >= 0 ? 'text-chart-green' : 'text-chart-red'}`}>
                ${totalPnl.toFixed(2)}
              </span>
            </span>
          </div>

          {renderChart()}
        </div>
      </div>
    </div>
  );
}
