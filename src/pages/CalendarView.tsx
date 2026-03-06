import { useTrades } from '@/hooks/useTrades';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CalendarView() {
  const { data: trades } = useTrades();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start, end });
  const startDow = getDay(start); // 0=Sun

  // Build daily PnL map
  const dailyPnl = new Map<string, number>();
  const dailyCount = new Map<string, number>();
  (trades ?? []).filter(t => t.status === 'closed' && t.pnl !== null).forEach(t => {
    const d = format(parseISO(t.entry_date), 'yyyy-MM-dd');
    dailyPnl.set(d, (dailyPnl.get(d) ?? 0) + (t.pnl ?? 0));
    dailyCount.set(d, (dailyCount.get(d) ?? 0) + 1);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trading Calendar</h1>
        <p className="text-muted-foreground text-sm">Daily P&L heatmap</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startDow }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map(day => {
            const key = format(day, 'yyyy-MM-dd');
            const pnl = dailyPnl.get(key);
            const count = dailyCount.get(key);
            const hasTrades = pnl !== undefined;

            return (
              <div
                key={key}
                className={cn(
                  'aspect-square rounded-lg border border-border p-2 flex flex-col items-center justify-center text-center transition-colors',
                  hasTrades && pnl! > 0 && 'bg-[hsl(142,71%,45%)]/10 border-[hsl(142,71%,45%)]/30',
                  hasTrades && pnl! < 0 && 'bg-[hsl(0,72%,51%)]/10 border-[hsl(0,72%,51%)]/30',
                  hasTrades && pnl === 0 && 'bg-secondary',
                )}
              >
                <span className="text-xs text-muted-foreground">{format(day, 'd')}</span>
                {hasTrades && (
                  <>
                    <span className={cn(
                      'font-mono text-xs font-bold mt-1',
                      pnl! > 0 ? 'text-[hsl(var(--chart-green))]' : pnl! < 0 ? 'text-[hsl(var(--chart-red))]' : 'text-muted-foreground'
                    )}>
                      {pnl! >= 0 ? '+' : ''}${pnl!.toFixed(0)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{count} trade{count! > 1 ? 's' : ''}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
