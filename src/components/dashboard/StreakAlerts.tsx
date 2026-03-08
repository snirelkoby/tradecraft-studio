import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Trade = Database['public']['Tables']['trades']['Row'];

interface StreakInfo {
  type: 'win' | 'loss';
  count: number;
  totalPnl: number;
}

export function StreakAlerts({ trades }: { trades: Trade[] }) {
  const { currentStreak, alerts } = useMemo(() => {
    const closed = trades
      .filter(t => t.status === 'closed' && t.pnl !== null)
      .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());

    if (closed.length === 0) return { currentStreak: null, alerts: [] };

    // Current streak
    const firstType = (closed[0].pnl ?? 0) >= 0 ? 'win' : 'loss';
    let count = 0;
    let totalPnl = 0;
    for (const t of closed) {
      const isWin = (t.pnl ?? 0) >= 0;
      if ((firstType === 'win' && isWin) || (firstType === 'loss' && !isWin)) {
        count++;
        totalPnl += t.pnl ?? 0;
      } else break;
    }

    const currentStreak: StreakInfo = { type: firstType, count, totalPnl };
    const alerts: string[] = [];

    if (firstType === 'loss' && count >= 3) {
      alerts.push(`⚠️ ${count} הפסדים ברצף — שקול לעצור מסחר ולנתח מה קרה`);
    }
    if (firstType === 'loss' && count >= 5) {
      alerts.push('🛑 5+ הפסדים ברצף — מומלץ מאוד לקחת הפסקה');
    }
    if (firstType === 'win' && count >= 5) {
      alerts.push('🔥 רצף רווחים חזק — שמור על משמעת, אל תגדיל פוזיציות בלי סיבה');
    }

    return { currentStreak, alerts };
  }, [trades]);

  if (!currentStreak) return null;

  const isLoss = currentStreak.type === 'loss';
  const isHotStreak = currentStreak.type === 'win' && currentStreak.count >= 3;
  const isDanger = isLoss && currentStreak.count >= 3;

  return (
    <div className={`rounded-xl border p-4 space-y-2 ${isDanger ? 'border-destructive/50 bg-destructive/5' : isHotStreak ? 'border-[hsl(var(--chart-green))]/50 bg-[hsl(var(--chart-green))]/5' : 'border-border bg-card'}`}>
      <div className="flex items-center gap-2">
        {isLoss ? <TrendingDown className="h-4 w-4 text-[hsl(var(--chart-red))]" /> : <TrendingUp className="h-4 w-4 text-[hsl(var(--chart-green))]" />}
        <span className="text-sm font-semibold">
          רצף נוכחי: {currentStreak.count} {currentStreak.type === 'win' ? 'רווחים' : 'הפסדים'}
        </span>
        <span className={`font-mono text-sm ${isLoss ? 'text-[hsl(var(--chart-red))]' : 'text-[hsl(var(--chart-green))]'}`}>
          ${currentStreak.totalPnl.toFixed(2)}
        </span>
      </div>
      {alerts.map((alert, i) => (
        <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3 mt-0.5 text-yellow-500 flex-shrink-0" />
          <span>{alert}</span>
        </div>
      ))}
    </div>
  );
}
