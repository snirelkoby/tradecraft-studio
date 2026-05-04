import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, type IChartApi, type ISeriesApi, type UTCTimestamp, LineStyle, CrosshairMode } from 'lightweight-charts';
import { supabase } from '@/integrations/supabase/client';
import { getYahooSymbol } from '@/lib/symbolMapping';
import { Loader2 } from 'lucide-react';


interface Execution {
  id: string;
  execution_type: string;
  price: number;
  quantity: number;
  executed_at: string;
}

interface TradingViewWidgetProps {
  symbol: string;
  assetType?: string;
  entryPrice?: number;
  exitPrice?: number | null;
  entryDate?: string;
  exitDate?: string | null;
  direction?: string;
  tradeId?: string;
  stopLoss?: number | null;
  takeProfit?: number | null;
}

// Pick Yahoo interval based on trade duration.
// Intraday → 1m candles. Multi-day → 1d.
function pickInterval(durationHours: number, multiDay: boolean): { interval: string; label: string } {
  if (multiDay) return { interval: '1d', label: '1d' };
  return { interval: '1m', label: '1m' };
}

const INTERVAL_OPTIONS = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '60m', label: '1h' },
  { value: '1d', label: '1d' },
];

export function TradingViewWidget({
  symbol, assetType, entryPrice, exitPrice, entryDate, exitDate, direction, tradeId, stopLoss, takeProfit,
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Determine if trade spans multiple days
  const multiDay = useMemo(() => {
    if (!entryDate) return false;
    const entry = new Date(entryDate);
    const exit = exitDate ? new Date(exitDate) : entry;
    return entry.toDateString() !== exit.toDateString();
  }, [entryDate, exitDate]);

  // Auto-pick interval, allow override
  const autoPick = useMemo(() => {
    if (!entryDate) return { interval: '60m', label: '1h' };
    const entry = new Date(entryDate);
    const exit = exitDate ? new Date(exitDate) : new Date();
    const hrs = (exit.getTime() - entry.getTime()) / 3600000;
    return pickInterval(Math.max(hrs, 0.1), multiDay);
  }, [entryDate, exitDate, multiDay]);

  const [interval, setInterval] = useState(autoPick.interval);
  useEffect(() => { setInterval(autoPick.interval); }, [autoPick.interval]);

  // Compute fetch range:
  // - intraday trade: fetch the full calendar day of the trade (with small pad)
  // - multi-day trade: fetch at least 3 months (centered on trade window)
  const { period1, period2 } = useMemo(() => {
    if (!entryDate) {
      const now = Math.floor(Date.now() / 1000);
      return { period1: now - 86400 * 90, period2: now };
    }
    const entry = new Date(entryDate);
    const exit = exitDate ? new Date(exitDate) : new Date();

    if (!multiDay) {
      // Full day surrounding the entry date
      const dayStart = new Date(entry); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(entry); dayEnd.setHours(23, 59, 59, 999);
      // Pad +/- 1 day so weekend/early hours render
      return {
        period1: Math.floor(dayStart.getTime() / 1000) - 86400,
        period2: Math.floor(dayEnd.getTime() / 1000) + 86400,
      };
    }

    // Multi-day: minimum 3 months of context
    const dur = exit.getTime() - entry.getTime();
    const minPad = 90 * 86400 * 1000; // 3 months
    const pad = Math.max(dur * 0.5, minPad);
    let p1 = Math.floor((entry.getTime() - pad) / 1000);
    let p2 = Math.floor((exit.getTime() + pad) / 1000);
    // Yahoo: 60m max ~730d, 1d max years
    const maxRange = interval === '1d' || interval === '1wk' ? 86400 * 365 * 5 : 86400 * 700;
    if (p2 - p1 > maxRange) p1 = p2 - maxRange;
    return { period1: p1, period2: p2 };
  }, [entryDate, exitDate, interval, multiDay]);

  const { data: chartData, isLoading, error } = useQuery({
    queryKey: ['yahoo-ohlc', symbol, assetType, interval, period1, period2],
    queryFn: async () => {
      const yahooSymbol = getYahooSymbol(symbol, assetType);
      const { data, error } = await supabase.functions.invoke('yahoo-ohlc', {
        body: { symbol: yahooSymbol, interval, period1, period2 },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!symbol,
    staleTime: 60_000,
  });

  const { data: executions } = useQuery({
    queryKey: ['trade-executions', tradeId],
    queryFn: async () => {
      if (!tradeId) return [];
      const { data, error } = await supabase
        .from('trade_executions').select('*').eq('trade_id', tradeId)
        .order('executed_at', { ascending: true });
      if (error) throw error;
      return data as Execution[];
    },
    enabled: !!tradeId,
  });

  // Build chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 400,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9ca3af',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(55, 65, 81, 0.25)' },
        horzLines: { color: 'rgba(55, 65, 81, 0.25)' },
      },
      timeScale: {
        borderColor: 'rgba(55, 65, 81, 0.5)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
      },
      rightPriceScale: {
        borderColor: 'rgba(55, 65, 81, 0.5)',
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      crosshair: { mode: CrosshairMode.Normal },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      color: 'rgba(100, 116, 139, 0.5)',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        chart.applyOptions({ width: e.contentRect.width });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // Populate candles + markers + SL/TP lines when data arrives
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    const candles = (chartData?.candles ?? []) as Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
    if (!candles.length) {
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      return;
    }

    candleSeriesRef.current.setData(
      candles.map(c => ({
        time: c.time as UTCTimestamp,
        open: c.open, high: c.high, low: c.low, close: c.close,
      }))
    );
    volumeSeriesRef.current.setData(
      candles.map(c => ({
        time: c.time as UTCTimestamp,
        value: c.volume ?? 0,
        color: c.close >= c.open ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)',
      }))
    );

    // Clear previous price lines
    const candleSeries = candleSeriesRef.current;
    // @ts-ignore - keep ref for cleanup
    if ((candleSeries as any)._priceLines) {
      (candleSeries as any)._priceLines.forEach((pl: any) => candleSeries.removePriceLine(pl));
    }
    const lines: any[] = [];

    if (entryPrice != null) {
      lines.push(candleSeries.createPriceLine({
        price: entryPrice, color: '#3b82f6', lineWidth: 2, lineStyle: LineStyle.Solid,
        axisLabelVisible: true, title: 'Entry',
      }));
    }
    if (exitPrice != null) {
      lines.push(candleSeries.createPriceLine({
        price: exitPrice, color: '#a855f7', lineWidth: 2, lineStyle: LineStyle.Solid,
        axisLabelVisible: true, title: 'Exit',
      }));
    }
    if (stopLoss != null) {
      lines.push(candleSeries.createPriceLine({
        price: stopLoss, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed,
        axisLabelVisible: true, title: 'SL',
      }));
    }
    if (takeProfit != null) {
      lines.push(candleSeries.createPriceLine({
        price: takeProfit, color: '#22c55e', lineWidth: 1, lineStyle: LineStyle.Dashed,
        axisLabelVisible: true, title: 'TP',
      }));
    }
    (candleSeries as any)._priceLines = lines;

    // Build markers
    const isLong = direction === 'long';
    const markers: Array<any> = [];
    if (entryDate && entryPrice != null) {
      markers.push({
        time: Math.floor(new Date(entryDate).getTime() / 1000) as UTCTimestamp,
        position: isLong ? 'belowBar' : 'aboveBar',
        color: '#3b82f6',
        shape: isLong ? 'arrowUp' : 'arrowDown',
        text: `Entry @ ${entryPrice}`,
      });
    }
    if (exitDate && exitPrice != null) {
      markers.push({
        time: Math.floor(new Date(exitDate).getTime() / 1000) as UTCTimestamp,
        position: isLong ? 'aboveBar' : 'belowBar',
        color: '#a855f7',
        shape: isLong ? 'arrowDown' : 'arrowUp',
        text: `Exit @ ${exitPrice}`,
      });
    }
    (executions ?? []).forEach(ex => {
      const isEntry = ex.execution_type === 'entry';
      markers.push({
        time: Math.floor(new Date(ex.executed_at).getTime() / 1000) as UTCTimestamp,
        position: isEntry ? (isLong ? 'belowBar' : 'aboveBar') : (isLong ? 'aboveBar' : 'belowBar'),
        color: isEntry ? '#10b981' : '#f59e0b',
        shape: 'circle',
        text: `${isEntry ? 'Scale In' : 'Scale Out'} ${ex.price}×${ex.quantity}`,
      });
    });
    markers.sort((a, b) => (a.time as number) - (b.time as number));

    // lightweight-charts v5: createSeriesMarkers helper
    import('lightweight-charts').then(({ createSeriesMarkers }) => {
      try {
        // Remove previous markers primitive if any
        if ((candleSeries as any)._markersPrimitive) {
          (candleSeries as any)._markersPrimitive.detach?.();
        }
        const prim = createSeriesMarkers(candleSeries, markers);
        (candleSeries as any)._markersPrimitive = prim;
      } catch (e) {
        console.warn('markers err', e);
      }
    });

    // Auto-zoom: intraday → full trading day; multi-day → ≥3 months
    if (entryDate) {
      const entry = new Date(entryDate);
      const exit = new Date(exitDate || new Date().toISOString());
      let fromTs: number, toTs: number;
      if (entry.toDateString() === exit.toDateString()) {
        // Full day
        const dayStart = new Date(entry); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(entry); dayEnd.setHours(23, 59, 59, 999);
        fromTs = Math.floor(dayStart.getTime() / 1000);
        toTs = Math.floor(dayEnd.getTime() / 1000);
      } else {
        const dur = exit.getTime() - entry.getTime();
        const minPad = 90 * 86400 * 1000; // 3 months
        const pad = Math.max(dur * 0.3, minPad);
        fromTs = Math.floor((entry.getTime() - pad) / 1000);
        toTs = Math.floor((exit.getTime() + pad) / 1000);
      }
      try {
        chartRef.current.timeScale().setVisibleRange({
          from: fromTs as UTCTimestamp,
          to: toTs as UTCTimestamp,
        });
      } catch {
        chartRef.current.timeScale().fitContent();
      }
    } else {
      chartRef.current.timeScale().fitContent();
    }
  }, [chartData, entryPrice, exitPrice, stopLoss, takeProfit, entryDate, exitDate, direction, executions]);

  // Header info
  const isLong = direction === 'long';
  const entryColor = '#3b82f6';
  const exitColor = '#a855f7';
  const entryArrow = isLong ? '▲' : '▼';
  const exitArrow = isLong ? '▼' : '▲';

  let rrRatio: string | null = null;
  let rrColor = 'text-muted-foreground';
  if (entryPrice != null && stopLoss != null && takeProfit != null) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    if (risk > 0) {
      const r = reward / risk;
      rrRatio = `1:${r.toFixed(2)}`;
      rrColor = r >= 2 ? 'text-[hsl(var(--chart-green))]' : r >= 1 ? 'text-yellow-500' : 'text-[hsl(var(--chart-red))]';
    }
  }

  const markerItems: Array<{ type: 'entry' | 'exit'; price: number; time: string; qty?: number }> = [];
  if (entryPrice != null && entryDate) markerItems.push({ type: 'entry', price: entryPrice, time: entryDate });
  if (exitPrice != null && exitDate) markerItems.push({ type: 'exit', price: exitPrice, time: exitDate });
  (executions ?? []).forEach(ex => {
    markerItems.push({ type: ex.execution_type === 'entry' ? 'entry' : 'exit', price: ex.price, time: ex.executed_at, qty: ex.quantity });
  });
  markerItems.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return (
    <div className="space-y-0">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-t-xl border border-b-0 border-border bg-secondary/50 text-xs">
        <div className="font-bold font-mono text-sm">{symbol}</div>
        <div className="flex items-center gap-1">
          {INTERVAL_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setInterval(opt.value)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                interval === opt.value ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {markerItems.map((m, i) => {
          const isEntry = m.type === 'entry';
          const color = isEntry ? entryColor : exitColor;
          const arrow = isEntry ? entryArrow : exitArrow;
          const label = isEntry ? (m.qty ? 'Scale In' : 'Entry') : (m.qty ? 'Scale Out' : 'Exit');
          return (
            <div key={i} className="flex items-center gap-1">
              <span style={{ color }} className="text-base">{arrow}</span>
              <span className="text-muted-foreground">{label}:</span>
              <span className="font-mono font-bold">${m.price}</span>
              {m.qty != null && m.qty > 0 && <span className="text-muted-foreground">×{m.qty}</span>}
              <span className="text-muted-foreground">
                ({new Date(m.time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })})
              </span>
            </div>
          );
        })}

        {stopLoss != null && (
          <div className="flex items-center gap-1">
            <span className="text-[hsl(var(--chart-red))]">━</span>
            <span className="text-muted-foreground">SL:</span>
            <span className="font-mono font-bold text-[hsl(var(--chart-red))]">${stopLoss}</span>
          </div>
        )}
        {takeProfit != null && (
          <div className="flex items-center gap-1">
            <span className="text-[hsl(var(--chart-green))]">━</span>
            <span className="text-muted-foreground">TP:</span>
            <span className="font-mono font-bold text-[hsl(var(--chart-green))]">${takeProfit}</span>
          </div>
        )}
        {rrRatio && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-accent/50 border border-border">
            <span className="text-muted-foreground">R:R</span>
            <span className={`font-mono font-bold ${rrColor}`}>{rrRatio}</span>
          </div>
        )}

        {direction && (
          <div className="ml-auto font-bold uppercase text-[11px]" style={{ color: isLong ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))' }}>
            {direction}
          </div>
        )}
      </div>

      <div className="border border-border rounded-b-xl overflow-hidden bg-card relative" style={{ height: 400 }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/40 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10 text-xs text-muted-foreground">
            Failed to load chart data
          </div>
        )}
        {!isLoading && !error && chartData?.candles?.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10 text-xs text-muted-foreground">
            No data for this range / interval
          </div>
        )}
        <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}
