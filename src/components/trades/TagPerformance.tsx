import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { Database } from '@/integrations/supabase/types';

type Trade = Database['public']['Tables']['trades']['Row'];

interface TagPerformanceProps {
  trades: Trade[];
}

interface TagStats {
  tag: string;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
}

export function TagPerformance({ trades }: TagPerformanceProps) {
  const tagStats = useMemo(() => {
    const map = new Map<string, { pnls: number[]; wins: number; losses: number }>();
    const closed = trades.filter(t => t.status === 'closed' && t.pnl !== null);
    
    closed.forEach(t => {
      (t.tags ?? []).forEach(tag => {
        if (!map.has(tag)) map.set(tag, { pnls: [], wins: 0, losses: 0 });
        const s = map.get(tag)!;
        s.pnls.push(t.pnl!);
        if (t.pnl! > 0) s.wins++;
        else s.losses++;
      });
    });

    const stats: TagStats[] = [];
    map.forEach((v, tag) => {
      const totalPnl = v.pnls.reduce((a, b) => a + b, 0);
      stats.push({
        tag,
        count: v.pnls.length,
        wins: v.wins,
        losses: v.losses,
        winRate: v.pnls.length > 0 ? (v.wins / v.pnls.length) * 100 : 0,
        totalPnl,
        avgPnl: v.pnls.length > 0 ? totalPnl / v.pnls.length : 0,
      });
    });

    return stats.sort((a, b) => b.count - a.count);
  }, [trades]);

  if (tagStats.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-6">No tagged trades yet</p>;
  }

  return (
    <div className="space-y-3">
      {tagStats.map(s => (
        <div key={s.tag} className="flex items-center justify-between bg-secondary rounded-lg p-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono text-xs">{s.tag}</Badge>
            <span className="text-xs text-muted-foreground">{s.count} trades</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-muted-foreground">WR: <span className={s.winRate >= 50 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}>{s.winRate.toFixed(0)}%</span></span>
            <span className="text-muted-foreground">Avg: <span className={s.avgPnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}>${s.avgPnl.toFixed(2)}</span></span>
            <span className={`font-bold ${s.totalPnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
              {s.totalPnl >= 0 ? '+' : ''}${s.totalPnl.toFixed(2)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
