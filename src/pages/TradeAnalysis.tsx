import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { useSelectedAccount } from '@/hooks/useSelectedAccount';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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

// Custom crosshair cursor for charts
const CrosshairCursor = (props: any) => {
  const { points, width, height, top, left } = props;
  if (!points || !points[0]) return null;
  const { x, y } = points[0];
  return (
    <g>
      <line x1={x} y1={top} x2={x} y2={top + height} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.6} />
      <line x1={left} y1={y} x2={left + width} y2={y} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.6} />
      <circle cx={x} cy={y} r={4} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={2} />
    </g>
  );
};

// Custom Bar shape that renders candle body + wicks
const CandleBarShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;

  const color = payload.isProfit ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-purple, 262 83% 58%))';
  const centerX = x + width / 2;
  const absHeight = Math.abs(height);
  const barTop = height >= 0 ? y : y + height;

  if (payload.wickHigh == null || payload.wickLow == null || payload.close === 0) {
    return (
      <g>
        <rect x={x} y={barTop} width={width} height={Math.max(absHeight, 2)} fill={color} rx={2} />
      </g>
    );
  }

  const pxPerDollar = absHeight / Math.abs(payload.close);
  const zeroY = payload.close >= 0 ? barTop + absHeight : barTop;

  const wickTopY = zeroY - Math.max(payload.wickHigh, 0) * pxPerDollar;
  const wickBottomY = zeroY + Math.abs(Math.min(payload.wickLow, 0)) * pxPerDollar;

  return (
    <g>
      <line x1={centerX} y1={wickTopY} x2={centerX} y2={wickBottomY} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} />
      <rect x={x} y={barTop} width={width} height={Math.max(absHeight, 2)} fill={color} rx={2} />
    </g>
  );
};

// CSV export helper
function downloadCSV(trades: Trade[], filename: string) {
  const headers = ['Date', 'Symbol', 'Direction', 'Asset Type', 'Strategy', 'Account', 'Entry Price', 'Exit Price', 'Quantity', 'Fees', 'P&L', 'P&L %', 'Status', 'Stop Loss', 'Take Profit', 'Tags', 'Notes'];
  const rows = trades.map(t => [
    t.entry_date,
    t.symbol,
    t.direction,
    t.asset_type ?? '',
    t.strategy ?? '',
    t.account_name ?? '',
    t.entry_price,
    t.exit_price ?? '',
    t.quantity,
    t.fees ?? 0,
    t.pnl ?? '',
    t.pnl_percent ?? '',
    t.status,
    t.stop_loss ?? '',
    t.take_profit ?? '',
    (t.tags ?? []).join('; '),
    (t.notes ?? '').replace(/,/g, ' '),
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TradeAnalysis() {
  const { data: trades, isLoading } = useTrades();
  const { selectedAccount } = useSelectedAccount();
  const [activeView, setActiveView] = useState<ViewId>('trade-candles');
  const [mode, setMode] = useState<'per-trade' | 'daily' | 'monthly'>('per-trade');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [yahooData, setYahooData] = useState<Record<string, YahooResult | null>>({});
  const [loadingYahoo, setLoadingYahoo] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [showAi, setShowAi] = useState(false);

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

  const calcWickPnl = useCallback((trade: Trade, yahooHigh: number, yahooLow: number) => {
    const pnl = trade.pnl ?? 0;
    const entry = trade.entry_price;
    const exit = trade.exit_price;
    
    if (!exit || exit === entry) return { wickHigh: null, wickLow: null };
    
    const fees = trade.fees ?? 0;
    const pnlBeforeFees = pnl + fees;
    const priceMove = trade.direction === 'long' ? exit - entry : entry - exit;
    
    if (priceMove === 0) return { wickHigh: null, wickLow: null };
    
    const dollarPerPoint = pnlBeforeFees / priceMove;
    
    const moveToHigh = trade.direction === 'long' ? yahooHigh - entry : entry - yahooLow;
    const moveToLow = trade.direction === 'long' ? yahooLow - entry : entry - yahooHigh;
    
    const pnlAtHigh = moveToHigh * dollarPerPoint - fees;
    const pnlAtLow = moveToLow * dollarPerPoint - fees;
    
    const cap = Math.max(Math.abs(pnl) * 3, 200);
    
    return {
      wickHigh: Math.min(Math.max(pnlAtHigh, pnlAtLow, pnl, 0), cap),
      wickLow: Math.max(Math.min(pnlAtHigh, pnlAtLow, pnl, 0), -cap),
    };
  }, []);

  const perTradeCandles = useMemo(() => {
    return closed.map((t, i) => {
      const pnl = t.pnl ?? 0;
      const yahoo = yahooData[t.id];

      let wickHigh: number | null = null;
      let wickLow: number | null = null;

      if (yahoo) {
        const wicks = calcWickPnl(t, yahoo.high, yahoo.low);
        wickHigh = wicks.wickHigh;
        wickLow = wicks.wickLow;
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
  }, [closed, yahooData, calcWickPnl]);

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

  const monthlyCandles = useMemo(() => {
    const monthMap = new Map<string, Trade[]>();
    closed.forEach(t => {
      const month = format(parseISO(t.entry_date), 'yyyy-MM');
      if (!monthMap.has(month)) monthMap.set(month, []);
      monthMap.get(month)!.push(t);
    });

    const result: any[] = [];
    monthMap.forEach((monthTrades, month) => {
      monthTrades.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
      let running = 0, high = 0, low = 0;
      monthTrades.forEach(t => {
        running += t.pnl ?? 0;
        if (running > high) high = running;
        if (running < low) low = running;
      });
      result.push({
        label: format(parseISO(month + '-01'), 'MMM yy'),
        fullDate: format(parseISO(month + '-01'), 'MMMM yyyy'),
        open: 0,
        close: running,
        wickHigh: high,
        wickLow: low,
        isProfit: running >= 0,
        pnl: running,
        trades: monthTrades.length,
      });
    });
    return result;
  }, [closed]);

  const candleData = mode === 'per-trade' ? perTradeCandles : mode === 'daily' ? dailyCandles : monthlyCandles;

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

  // AI insights handler
  const fetchAiInsights = async () => {
    setLoadingAi(true);
    setShowAi(true);
    setAiInsights(null);
    try {
      const { data, error } = await supabase.functions.invoke('trade-insights', {
        body: { trades: closed },
      });
      if (error) throw error;
      setAiInsights(data.insights || data.error || 'No insights.');
    } catch (e: any) {
      setAiInsights('שגיאה בטעינת תובנות: ' + (e.message || 'Unknown error'));
    } finally {
      setLoadingAi(false);
    }
  };

  const renderCandlestickChart = () => {
    if (candleData.length === 0) {
      return <p className="text-muted-foreground text-center py-20">No closed trades in selected range</p>;
    }

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
          <Tooltip content={<CandleTooltip />} cursor={<CrosshairCursor />} />
          <Bar dataKey="close" barSize={mode === 'per-trade' ? 8 : mode === 'daily' ? 20 : 30} name="P&L" shape={<CandleBarShape />}>
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
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Equity']} cursor={<CrosshairCursor />} />
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
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Long Equity']} cursor={<CrosshairCursor />} />
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
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Short Equity']} cursor={<CrosshairCursor />} />
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
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}%`, 'Drawdown']} cursor={<CrosshairCursor />} />
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
              <Tooltip contentStyle={tooltipStyle} cursor={<CrosshairCursor />} />
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
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']} cursor={<CrosshairCursor />} />
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
        <div className="lg:w-56 flex-shrink-0 space-y-3">
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

          {/* AI Insights Button */}
          <Button
            onClick={fetchAiInsights}
            disabled={loadingAi || closed.length === 0}
            className="w-full gap-2"
            variant="outline"
          >
            {loadingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI Insights
          </Button>

          {/* Export Button */}
          <Button
            onClick={() => downloadCSV(closed, `trades-${dateFrom || 'all'}-${dateTo || 'all'}.csv`)}
            disabled={closed.length === 0}
            className="w-full gap-2"
            variant="outline"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Main chart area */}
        <div className="flex-1 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
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
                  <button
                    onClick={() => setMode('monthly')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      mode === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Monthly
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

          {/* AI Insights Panel */}
          {showAi && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">AI Insights</h3>
                </div>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowAi(false)}>סגור</Button>
              </div>
              {loadingAi ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  מנתח את העסקאות שלך...
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown>{aiInsights || ''}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
