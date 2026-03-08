import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, TrendingUp, TrendingDown, RefreshCw, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WatchlistItem {
  id: string;
  symbol: string;
  company_name: string | null;
}

interface StockData {
  symbol: string;
  price: number;
  change_percent: number;
  company_name: string;
  news: { title: string; time_ago: string }[];
}

export function StockWatchlist({ accountId }: { accountId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [stockData, setStockData] = useState<Record<string, StockData>>({});
  const [newSymbol, setNewSymbol] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [expandedNews, setExpandedNews] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !accountId) return;
    loadWatchlist();
  }, [user, accountId]);

  const loadWatchlist = async () => {
    const { data } = await supabase
      .from('account_watchlist' as any)
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true });
    setItems((data as any as WatchlistItem[]) || []);
    setLoading(false);
  };

  const addSymbol = async () => {
    if (!user || !newSymbol.trim()) return;
    const symbol = newSymbol.trim().toUpperCase();
    const { error } = await supabase.from('account_watchlist' as any).insert({
      user_id: user.id,
      account_id: accountId,
      symbol,
    } as any);
    if (error) {
      if (error.code === '23505') toast.error('סימול כבר קיים ברשימה');
      else toast.error(error.message);
      return;
    }
    setNewSymbol('');
    loadWatchlist();
    toast.success(`${symbol} נוסף לרשימת מעקב`);
  };

  const removeSymbol = async (id: string) => {
    await supabase.from('account_watchlist' as any).delete().eq('id', id);
    loadWatchlist();
  };

  const fetchStockData = async () => {
    if (!items.length) return;
    setFetching(true);
    try {
      const symbols = items.map(i => i.symbol);
      const { data, error } = await supabase.functions.invoke('stock-data', {
        body: { symbols },
      });
      if (error) throw error;
      if (data?.stocks) {
        const map: Record<string, StockData> = {};
        data.stocks.forEach((s: StockData) => { map[s.symbol] = s; });
        setStockData(map);
      }
    } catch (e: any) {
      toast.error('שגיאה בטעינת נתוני מניות');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (items.length > 0) fetchStockData();
  }, [items.length]);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> רשימת מעקב
        </h4>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchStockData} disabled={fetching}>
          <RefreshCw className={cn("h-3 w-3", fetching && "animate-spin")} />
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          value={newSymbol}
          onChange={e => setNewSymbol(e.target.value)}
          placeholder="AAPL, TSLA..."
          className="bg-secondary h-8 text-xs"
          onKeyDown={e => e.key === 'Enter' && addSymbol()}
        />
        <Button size="sm" className="h-8 px-3" onClick={addSymbol}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">אין מניות ברשימת מעקב</p>
      ) : (
        <div className="space-y-1">
          {items.map(item => {
            const data = stockData[item.symbol];
            const isUp = data ? data.change_percent >= 0 : false;
            return (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 group">
                  <span className="font-mono font-bold text-xs w-12">{item.symbol}</span>
                  {data ? (
                    <>
                      <span className="font-mono text-xs flex-1">${data.price.toFixed(2)}</span>
                      <span className={cn("font-mono text-xs font-bold flex items-center gap-1",
                        isUp ? "text-chart-green" : "text-chart-red"
                      )}>
                        {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isUp ? '+' : ''}{data.change_percent.toFixed(2)}%
                      </span>
                      {data.news?.length > 0 && (
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => setExpandedNews(expandedNews === item.symbol ? null : item.symbol)}
                        >
                          <Newspaper className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground flex-1">—</span>
                  )}
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeSymbol(item.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                {expandedNews === item.symbol && data?.news?.length > 0 && (
                  <div className="ml-4 space-y-1 pb-1">
                    {data.news.map((n, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px]">
                        <span className="text-muted-foreground shrink-0">{n.time_ago}</span>
                        <span className="text-foreground">{n.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
