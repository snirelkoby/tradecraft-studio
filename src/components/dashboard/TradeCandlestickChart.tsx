import { useMemo, useCallback } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Trade = Database['public']['Tables']['trades']['Row'];

interface CandleData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  isProfit: boolean;
  barHeight: number;
}

export function TradeCandlestickChart({ trades }: { trades: Trade[] }) {
  const candles = useMemo(() => {
    const closed = trades
      .filter(t => t.status === 'closed' && t.pnl !== null)
      .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

    const dayMap = new Map<string, Trade[]>();
    closed.forEach(t => {
      const day = format(parseISO(t.entry_date), 'yyyy-MM-dd');
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(t);
    });

    const result: CandleData[] = [];
    dayMap.forEach((dayTrades, day) => {
      dayTrades.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

      let running = 0;
      let high = 0;
      let low = 0;

      dayTrades.forEach(t => {
        running += t.pnl ?? 0;
        if (running > high) high = running;
        if (running < low) low = running;
      });

      result.push({
        date: format(parseISO(day), 'MMM dd'),
        open: 0,
        close: running,
        high,
        low,
        isProfit: running >= 0,
        barHeight: Math.max(Math.abs(running), 0.01),
      });
    });

    return result;
  }, [trades]);

  const yDomain = useMemo(() => {
    if (candles.length === 0) return [0, 1];
    const allVals = candles.flatMap(c => [c.high, c.low, c.open, c.close]);
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const pad = (max - min || 1) * 0.15;
    return [min - pad, max + pad];
  }, [candles]);

  const CandleShape = useCallback((props: any) => {
    const { x, width, payload, background } = props;
    if (!payload || !background) return null;

    const { open, close, high, low, isProfit } = payload;
    const color = isProfit ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))';
    const wickColor = 'hsl(var(--muted-foreground))';

    const plotY = background.y;
    const plotHeight = background.height;
    const [yMin, yMax] = yDomain;

    const valToY = (v: number) => plotY + plotHeight - ((v - yMin) / (yMax - yMin)) * plotHeight;

    const centerX = x + width / 2;
    const bodyTop = valToY(Math.max(open, close));
    const bodyBottom = valToY(Math.min(open, close));
    const bodyH = Math.max(bodyBottom - bodyTop, 2);
    const wickTop = valToY(high);
    const wickBottom = valToY(low);
    const bodyWidth = Math.max(width - 4, 4);

    return (
      <g>
        {/* Upper wick */}
        <line x1={centerX} y1={wickTop} x2={centerX} y2={bodyTop} stroke={wickColor} strokeWidth={1.5} />
        {/* Lower wick */}
        <line x1={centerX} y1={bodyBottom} x2={centerX} y2={wickBottom} stroke={wickColor} strokeWidth={1.5} />
        {/* Body */}
        <rect
          x={x + (width - bodyWidth) / 2}
          y={bodyTop}
          width={bodyWidth}
          height={bodyH}
          fill={color}
          stroke={color}
          strokeWidth={1}
          rx={2}
          fillOpacity={0.85}
        />
      </g>
    );
  }, [yDomain]);

  if (candles.length === 0) return <p className="text-muted-foreground text-sm text-center py-12">No data</p>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={candles}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickFormatter={(v) => `$${v}`}
          domain={yDomain}
        />
        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload as CandleData;
            return (
              <div className="bg-popover border border-border rounded-lg p-3 text-xs space-y-1">
                <p className="font-bold">{label}</p>
                <p>Open: <span className="font-mono">${d.open.toFixed(2)}</span></p>
                <p>Close: <span className="font-mono">${d.close.toFixed(2)}</span></p>
                <p>High: <span className="font-mono text-chart-green">${d.high.toFixed(2)}</span></p>
                <p>Low: <span className="font-mono text-chart-red">${d.low.toFixed(2)}</span></p>
              </div>
            );
          }}
        />
        <Bar
          dataKey="barHeight"
          shape={<CandleShape />}
          barSize={20}
          isAnimationActive={false}
        >
          {candles.map((_, i) => (
            <Cell key={i} fill="transparent" />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
