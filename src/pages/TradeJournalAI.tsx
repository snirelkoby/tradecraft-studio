import { useState, useMemo, useEffect } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { useSelectedAccount } from '@/hooks/useSelectedAccount';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Loader2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

export default function TradeJournalAI() {
  const { data: allTrades } = useTrades();
  const { selectedAccount } = useSelectedAccount();
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dbLoaded, setDbLoaded] = useState(false);

  const trades = useMemo(() => {
    if (!allTrades) return [];
    const filtered = selectedAccount === 'all' ? allTrades : allTrades.filter(t => t.account_name === selectedAccount);
    return filtered.filter(t => t.status === 'closed').sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
  }, [allTrades, selectedAccount]);

  // Load existing summaries from DB
  useEffect(() => {
    if (!user || dbLoaded) return;
    (async () => {
      const { data } = await supabase
        .from('trade_ai_summaries' as any)
        .select('trade_id, summary')
        .eq('user_id', user.id);
      if (data) {
        const map: Record<string, string> = {};
        (data as any[]).forEach((r: any) => { map[r.trade_id] = r.summary; });
        setSummaries(map);
      }
      setDbLoaded(true);
    })();
  }, [user, dbLoaded]);

  const saveSummaryToDB = async (tradeId: string, summary: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('trade_ai_summaries' as any)
      .upsert({ user_id: user.id, trade_id: tradeId, summary, updated_at: new Date().toISOString() } as any, { onConflict: 'user_id,trade_id' });
    if (error) console.error('Failed to save summary:', error);
  };

  const deleteSummary = async (tradeId: string) => {
    if (!user) return;
    setSummaries(prev => { const n = { ...prev }; delete n[tradeId]; return n; });
    await supabase.from('trade_ai_summaries' as any).delete().eq('user_id', user.id).eq('trade_id', tradeId);
    toast.success('Summary deleted');
  };

  const generateSummary = async (trade: any) => {
    setLoading(prev => ({ ...prev, [trade.id]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('trade-journal-ai', {
        body: { trade },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSummaries(prev => ({ ...prev, [trade.id]: data.summary }));
      setExpanded(prev => ({ ...prev, [trade.id]: true }));
      await saveSummaryToDB(trade.id, data.summary);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate summary');
    } finally {
      setLoading(prev => ({ ...prev, [trade.id]: false }));
    }
  };

  const generateAll = async () => {
    const ungenerated = trades.filter(t => !summaries[t.id]).slice(0, 10);
    if (!ungenerated.length) { toast.info('All trades already have summaries'); return; }
    for (const trade of ungenerated) {
      await generateSummary(trade);
      await new Promise(r => setTimeout(r, 1500));
    }
  };

  const savedCount = Object.keys(summaries).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" /> Trade Journaling AI
          </h1>
          <p className="text-muted-foreground text-sm">סיכום אוטומטי של כל עסקה עם AI — נשמר אוטומטית בדאטאבייס</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">{savedCount} summaries saved</Badge>
          <Button onClick={generateAll} disabled={Object.values(loading).some(Boolean)}>
            <Bot className="h-4 w-4 mr-2" /> Generate All (max 10)
          </Button>
        </div>
      </div>

      {trades.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            No closed trades found. Close some trades to get AI journal summaries.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {trades.map(trade => {
          const pnl = trade.pnl ?? 0;
          const isWin = pnl > 0;
          return (
            <Card key={trade.id} className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base font-mono">{trade.symbol}</CardTitle>
                    <Badge variant={trade.direction === 'long' ? 'default' : 'secondary'} className="text-xs">
                      {trade.direction}
                    </Badge>
                    <span className={`font-mono font-bold text-sm ${isWin ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                      {isWin ? '+' : ''}{pnl.toFixed(2)}$
                    </span>
                    <span className="text-xs text-muted-foreground">{trade.entry_date?.slice(0, 10)}</span>
                    {summaries[trade.id] && <Badge variant="outline" className="text-[10px] bg-primary/10">✓ Saved</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {summaries[trade.id] && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => deleteSummary(trade.id)}>
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setExpanded(prev => ({ ...prev, [trade.id]: !prev[trade.id] }))}>
                          {expanded[trade.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant={summaries[trade.id] ? 'outline' : 'default'}
                      onClick={() => generateSummary(trade)}
                      disabled={loading[trade.id]}
                    >
                      {loading[trade.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4 mr-1" />}
                      {summaries[trade.id] ? 'Refresh' : 'Generate'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {summaries[trade.id] && expanded[trade.id] && (
                <CardContent className="pt-0">
                  <div className="bg-muted/30 rounded-lg p-4 prose prose-sm dark:prose-invert max-w-none text-sm" dir="rtl">
                    <ReactMarkdown>{summaries[trade.id]}</ReactMarkdown>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
