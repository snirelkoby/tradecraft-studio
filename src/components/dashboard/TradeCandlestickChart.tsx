import { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ErrorBar } from 'recharts';
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
}

/**
 * Creates daily candles where:
 * - open = 0 (start of day)
 * - close = total P&L for the day
 * - high = highest running P&L during the day
 * - low = lowest running P&L during the day
 * Rendered as Japanese candlesticks
 */
export function TradeCandlestickChart({ trades }: { trades: Trade[] }) {
  const candles = useMemo(() => {
    const closed = trades
      .filter(t => t.status === 'closed' && t.pnl !== null)
      .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

    // Group by day
    const dayMap = new Map<string, Trade[]>();
    closed.forEach(t => {
      const day = format(parseISO(t.entry_date), 'yyyy-MM-dd');
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(t);
    });

    const result: CandleData[] = [];
    dayMap.forEach((dayTrades, day) => {
      // Sort trades within the day by time
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
      });
    });

    return result;
  }, [trades]);

  if (candles.length === 0) return <p className="text-muted-foreground text-sm text-center py-12">No data</p>;

  // Custom candle shape
  const CandleShape = (props: any) => {
    const { x, y, width, height, payload } = props;
    if (!payload) return null;

    const { open, close, high, low, isProfit } = payload;
    const color = isProfit ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))';

    // Calculate positions using the chart's Y scale
    const yScale = props.yAxis;
    if (!yScale) return null;

    const bodyTop = Math.min(open, close);
    const bodyBottom = Math.max(open, close);
    const bodyHeight = Math.max(Math.abs(height), 2);

    const centerX = x + width / 2;
    const wickWidth = 1.5;

    // Use the actual y position from recharts
    const yHigh = yScale.scale(high);
    const yLow = yScale.scale(low);
    const yBodyTop = yScale.scale(Math.max(open, close));
    const yBodyBottom = yScale.scale(Math.min(open, close));

    return (
      <g>
        {/* Upper wick */}
        <line
          x1={centerX}
          y1={yHigh}
          x2={centerX}
          y2={yBodyTop}
          stroke={color}
          strokeWidth={wickWidth}
        />
        {/* Body */}
        <rect
          x={x + 2}
          y={yBodyTop}
          width={Math.max(width - 4, 4)}
          height={Math.max(yBodyBottom - yBodyTop, 2)}
          fill={isProfit ? color : color}
          stroke={color}
          strokeWidth={1}
          rx={2}
        />
        {/* Lower wick */}
        <line
          x1={centerX}
          y1={yBodyBottom}
          x2={centerX}
          y2={yLow}
          stroke={color}
          strokeWidth={wickWidth}
        />
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={candles}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            color: 'hsl(var(--foreground))',
          }}
          formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]}
          labelFormatter={(label) => `Date: ${label}`}
        />
        {/* Invisible bars for candle bodies */}
        <Bar dataKey="close" radius={[2, 2, 2, 2]} barSize={20}>
          {candles.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.isProfit ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))'}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
        {/* Lines for wicks - high */}
        <Line type="monotone" dataKey="high" stroke="hsl(var(--muted-foreground))" strokeWidth={0} dot={{ r: 3, fill: 'hsl(var(--chart-green))' }} name="Day High" />
        <Line type="monotone" dataKey="low" stroke="hsl(var(--muted-foreground))" strokeWidth={0} dot={{ r: 3, fill: 'hsl(var(--chart-red))' }} name="Day Low" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
