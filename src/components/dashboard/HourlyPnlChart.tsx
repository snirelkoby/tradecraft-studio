import { useMemo } from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { parseISO } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Trade = Database['public']['Tables']['trades']['Row'];

export function HourlyPnlChart({ trades }: { trades: Trade[] }) {
  const data = useMemo(() => {
    const hourMap = new Map<number, number>();
    for (let h = 0; h < 24; h++) hourMap.set(h, 0);

    trades
      .filter(t => t.status === 'closed' && t.pnl !== null)
      .forEach(t => {
        const hour = parseISO(t.entry_date).getHours();
        hourMap.set(hour, (hourMap.get(hour) ?? 0) + (t.pnl ?? 0));
      });

    return Array.from(hourMap.entries())
      .map(([hour, pnl]) => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        pnl,
      }))
      .filter(d => d.pnl !== 0);
  }, [trades]);

  if (data.length === 0) return <p className="text-muted-foreground text-sm text-center py-12">No data</p>;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }}
          formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']}
        />
        <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.pnl >= 0 ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
