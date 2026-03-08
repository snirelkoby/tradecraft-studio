import { useMemo } from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { parseISO } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Trade = Database['public']['Tables']['trades']['Row'];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function DayOfWeekChart({ trades }: { trades: Trade[] }) {
  const data = useMemo(() => {
    const dayMap = new Map<number, { pnl: number; count: number }>();
    for (let d = 0; d < 7; d++) dayMap.set(d, { pnl: 0, count: 0 });

    trades
      .filter(t => t.status === 'closed' && t.pnl !== null)
      .forEach(t => {
        const day = parseISO(t.entry_date).getDay();
        const entry = dayMap.get(day)!;
        entry.pnl += t.pnl ?? 0;
        entry.count++;
      });

    return Array.from(dayMap.entries())
      .filter(([_, v]) => v.count > 0)
      .map(([day, v]) => ({
        day: DAYS[day].slice(0, 3),
        pnl: v.pnl,
        trades: v.count,
      }));
  }, [trades]);

  if (data.length === 0) return <p className="text-muted-foreground text-sm text-center py-12">No data</p>;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }}
          formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name === 'pnl' ? 'P&L' : name]}
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
