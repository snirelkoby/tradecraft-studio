import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Headline {
  text: string;
  timestamp: string;
  category: string;
  impact: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  fed: 'bg-yellow-500/20 text-yellow-400',
  earnings: 'bg-blue-500/20 text-blue-400',
  macro: 'bg-purple-500/20 text-purple-400',
  geopolitical: 'bg-red-500/20 text-red-400',
  market: 'bg-emerald-500/20 text-emerald-400',
  crypto: 'bg-orange-500/20 text-orange-400',
};

export function WalterNewsFeed() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('walter-news');
      if (error) throw error;
      if (data?.headlines?.length) {
        setHeadlines(data.headlines);
        setLastFetch(new Date());
      }
    } catch (e: any) {
      if (e?.message?.includes('429')) toast.error('Rate limit - נסה שוב בעוד דקה');
      else toast.error('שגיאה בטעינת חדשות');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const formatTime = (ts: string) => {
    try {
      return formatDistanceToNow(new Date(ts), { addSuffix: true });
    } catch {
      return '';
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-400" />
          <h2 className="text-lg font-semibold">Walter Bloomberg — חדשות 24 שעות אחרונות</h2>
          <span className="w-2 h-2 rounded-full bg-chart-green animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          {lastFetch && (
            <span className="text-[10px] text-muted-foreground">
              עודכן {formatDistanceToNow(lastFetch, { addSuffix: true })}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchNews} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {loading && headlines.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : headlines.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">לחץ על רענן לטעינת חדשות</p>
      ) : (
        <div className="space-y-1 max-h-[500px] overflow-auto">
          {headlines.map((h, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
              <span className={cn(
                "inline-block w-2 h-2 rounded-full mt-1.5 shrink-0",
                h.impact === 'high' ? 'bg-[hsl(var(--chart-red))]' :
                h.impact === 'medium' ? 'bg-orange-500' : 'bg-yellow-500'
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{h.text}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{formatTime(h.timestamp)}</span>
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase", CATEGORY_COLORS[h.category] || 'bg-muted text-muted-foreground')}>
                    {h.category}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
