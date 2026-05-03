import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TradingViewWidget } from './TradingViewWidget';
import { ScreenshotUpload } from './ScreenshotUpload';
import { TradeExecutions } from './TradeExecutions';
import { TrendingUp, TrendingDown, Edit3, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useUpdateTrade, calculateFuturesPnl } from '@/hooks/useTrades';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FUTURES_CONFIG, FOREX_PAIRS, CRYPTO_SYMBOLS } from '@/lib/assetConfig';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Trade = Database['public']['Tables']['trades']['Row'];

interface TradeDetailProps {
  trade: Trade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trades?: Trade[];
  onTradeChange?: (trade: Trade) => void;
}

export function TradeDetail({ trade, open, onOpenChange, trades, onTradeChange }: TradeDetailProps) {
  const { user } = useAuth();
  const updateTrade = useUpdateTrade();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Trade>>({});
  const [unrealizedPnl, setUnrealizedPnl] = useState<number | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  // Fetch blueprints for strategy dropdown
  const { data: blueprints } = useQuery({
    queryKey: ['blueprints', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blueprints')
        .select('id, name, tier')
        .order('tier', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (trade) {
      setForm({
        symbol: trade.symbol,
        asset_type: trade.asset_type,
        entry_price: trade.entry_price,
        exit_price: trade.exit_price,
        stop_loss: trade.stop_loss,
        take_profit: trade.take_profit,
        quantity: trade.quantity,
        fees: trade.fees,
        direction: trade.direction,
        entry_date: trade.entry_date,
        exit_date: trade.exit_date,
        notes: trade.notes,
        strategy: trade.strategy,
        status: trade.status,
      });
      setEditing(false);
      setUnrealizedPnl(null);
      setLivePrice(null);
    }
  }, [trade]);

  // Fetch live price for open trades
  useEffect(() => {
    if (!trade || trade.status !== 'open') return;
    const fetchPrice = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('stock-data', {
          body: { symbol: trade.symbol, assetType: trade.asset_type },
        });
        if (error) return;
        const price = data?.price ?? data?.regularMarketPrice ?? data?.lastPrice;
        if (price) {
          setLivePrice(price);
          const dir = trade.direction as 'long' | 'short';
          const qty = trade.quantity;
          const fees = trade.fees ?? 0;
          const isFutures = trade.asset_type === 'Futures';
          if (isFutures) {
            const result = calculateFuturesPnl(trade.symbol, dir, trade.entry_price, price, qty, fees);
            setUnrealizedPnl(result.pnl);
          } else {
            const raw = dir === 'long'
              ? (price - trade.entry_price) * qty
              : (trade.entry_price - price) * qty;
            setUnrealizedPnl(raw - fees);
          }
        }
      } catch {}
    };
    fetchPrice();
  }, [trade]);

  if (!trade) return null;

  // Navigation
  const currentIndex = trades?.findIndex(t => t.id === trade.id) ?? -1;
  const hasPrev = currentIndex > 0;
  const hasNext = trades ? currentIndex < trades.length - 1 : false;
  const goPrev = () => { if (hasPrev && trades && onTradeChange) onTradeChange(trades[currentIndex - 1]); };
  const goNext = () => { if (hasNext && trades && onTradeChange) onTradeChange(trades[currentIndex + 1]); };

  const handleSave = async () => {
    const symbol = (form.symbol || trade.symbol).toUpperCase();
    if (!symbol) {
      toast.error('Symbol is required');
      return;
    }
    try {
      // Fetch executions to calculate scale in/out
      const { data: executions } = await supabase
        .from('trade_executions')
        .select('*')
        .eq('trade_id', trade.id)
        .order('executed_at', { ascending: true });

      const entryPrice = Number(form.entry_price);
      const exitPrice = form.exit_price ? Number(form.exit_price) : null;
      const qty = Number(form.quantity) || 1;
      const fees = Number(form.fees) || 0;
      const dir = form.direction || trade.direction;
      const status = exitPrice ? 'closed' : 'open';
      const assetType = form.asset_type || trade.asset_type;
      const isFutures = assetType === 'Futures';

      // Calculate weighted average entry/exit from executions
      let avgEntry = entryPrice;
      let avgExit = exitPrice;
      let totalEntryQty = qty;
      let totalExitQty = exitPrice ? qty : 0;

      if (executions && executions.length > 0) {
        const entries = executions.filter(e => e.execution_type === 'entry');
        const exits = executions.filter(e => e.execution_type === 'exit');

        if (entries.length > 0) {
          // Include main trade entry + all scale-ins
          const allEntries = [{ price: entryPrice, quantity: qty }, ...entries.map(e => ({ price: Number(e.price), quantity: Number(e.quantity) }))];
          totalEntryQty = allEntries.reduce((s, e) => s + e.quantity, 0);
          avgEntry = allEntries.reduce((s, e) => s + e.price * e.quantity, 0) / totalEntryQty;
        }

        if (exits.length > 0 && exitPrice) {
          const allExits = [{ price: exitPrice, quantity: qty }, ...exits.map(e => ({ price: Number(e.price), quantity: Number(e.quantity) }))];
          totalExitQty = allExits.reduce((s, e) => s + e.quantity, 0);
          avgExit = allExits.reduce((s, e) => s + e.price * e.quantity, 0) / totalExitQty;
        }
      }

      let pnl = trade.pnl;
      let pnlPercent = trade.pnl_percent;

      if (avgExit) {
        const effectiveQty = Math.min(totalEntryQty, totalExitQty);
        if (isFutures) {
          const result = calculateFuturesPnl(symbol, dir as 'long' | 'short', avgEntry, avgExit, effectiveQty, fees);
          pnl = result.pnl;
          pnlPercent = result.pnlPercent;
        } else {
          const raw = dir === 'long'
            ? (avgExit - avgEntry) * effectiveQty
            : (avgEntry - avgExit) * effectiveQty;
          pnl = raw - fees;
          pnlPercent = ((avgExit - avgEntry) / avgEntry) * 100 * (dir === 'short' ? -1 : 1);
        }
      }

      await updateTrade.mutateAsync({
        id: trade.id,
        ...form,
        symbol,
        pnl,
        pnl_percent: pnlPercent,
        status,
      } as any);
      toast.success('Trade updated');
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const displayPnl = trade.status === 'open' ? unrealizedPnl : trade.pnl;
  const pnlLabel = trade.status === 'open' ? 'Unrealized P&L' : 'Net P&L';
  const pnlColor = displayPnl !== null ? (displayPnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]') : '';

  // Build strategy options from blueprints
  const strategyOptions = (blueprints ?? []).map(b => ({
    value: b.name || `${b.tier} Setup`,
    label: `${b.name || 'Unnamed'} (${b.tier})`,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto bg-card border-border p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 mr-2">
              <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!hasPrev} onClick={goPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!hasNext} onClick={goNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {editing ? (
              <Input className="h-8 w-28 text-lg font-bold bg-secondary" value={form.symbol ?? trade.symbol} onChange={e => setForm({ ...form, symbol: e.target.value.toUpperCase() })} />
            ) : (
              <span className="text-xl font-bold">{trade.symbol}</span>
            )}
            <span className="text-xs text-muted-foreground">{format(parseISO(trade.entry_date), 'MMM dd, yyyy HH:mm')}</span>
            <Badge variant={trade.direction === 'long' ? 'default' : 'secondary'}>
              {trade.direction === 'long' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {trade.direction.toUpperCase()}
            </Badge>
            {trade.asset_type && <Badge variant="outline" className="text-xs">{trade.asset_type}</Badge>}
            <Badge variant={trade.status === 'open' ? 'default' : 'secondary'}>{trade.status}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" />Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={updateTrade.isPending}><Save className="h-4 w-4 mr-1" />Save</Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Edit3 className="h-4 w-4 mr-1" />Edit</Button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row animate-fade-in" key={trade.id}>
          {/* Left Panel - Stats */}
          <div className="lg:w-72 shrink-0 border-r border-border p-5 space-y-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">{pnlLabel}</p>
              <p className={`text-2xl font-bold font-mono ${pnlColor}`}>
                {displayPnl !== null ? `${displayPnl >= 0 ? '+' : ''}$${displayPnl.toFixed(2)}` : '—'}
              </p>
              {trade.status === 'open' && livePrice !== null && (
                <p className="text-xs text-muted-foreground">Live: ${livePrice.toFixed(2)}</p>
              )}
              {trade.status === 'closed' && trade.pnl_percent !== null && (
                <p className={`text-sm font-mono ${pnlColor}`}>{trade.pnl_percent.toFixed(2)}%</p>
              )}
            </div>

            <div className="space-y-2.5 text-sm">
              <StatRow label="Asset Type" value={
                editing ? (
                  <Select value={form.asset_type ?? 'Stocks'} onValueChange={v => setForm({ ...form, asset_type: v })}>
                    <SelectTrigger className="h-7 w-28 text-xs bg-secondary"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Futures">Futures</SelectItem>
                      <SelectItem value="Stocks">Stocks</SelectItem>
                      <SelectItem value="Crypto">Crypto</SelectItem>
                      <SelectItem value="Forex">Forex</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (trade.asset_type || '—')
              } />
              <StatRow label="Side" value={
                editing ? (
                  <select className="bg-secondary rounded px-2 py-1 text-xs border border-border" value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })}>
                    <option value="long">LONG</option>
                    <option value="short">SHORT</option>
                  </select>
                ) : (
                  <span className={trade.direction === 'long' ? 'text-[hsl(var(--chart-green))] font-bold' : 'text-[hsl(var(--chart-red))] font-bold'}>
                    {trade.direction.toUpperCase()}
                  </span>
                )
              } />
              <StatRow label="Contracts" value={
                editing ? <Input type="number" className="h-7 w-20 text-xs bg-secondary" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} />
                : trade.quantity.toString()
              } />
              <StatRow label="Entry Price" value={
                editing ? <Input type="number" step="any" className="h-7 w-24 text-xs bg-secondary" value={form.entry_price} onChange={e => setForm({ ...form, entry_price: Number(e.target.value) })} />
                : `$${trade.entry_price}`
              } />
              <StatRow label="Exit Price" value={
                editing ? <Input type="number" step="any" className="h-7 w-24 text-xs bg-secondary" value={form.exit_price ?? ''} onChange={e => setForm({ ...form, exit_price: e.target.value ? Number(e.target.value) : null })} />
                : (trade.exit_price ? `$${trade.exit_price}` : '—')
              } />
              <StatRow label="Stop Loss" value={
                editing ? <Input type="number" step="any" className="h-7 w-24 text-xs bg-secondary" value={form.stop_loss ?? ''} onChange={e => setForm({ ...form, stop_loss: e.target.value ? Number(e.target.value) : null })} />
                : (trade.stop_loss ? `$${trade.stop_loss}` : '—')
              } />
              <StatRow label="Take Profit" value={
                editing ? <Input type="number" step="any" className="h-7 w-24 text-xs bg-secondary" value={form.take_profit ?? ''} onChange={e => setForm({ ...form, take_profit: e.target.value ? Number(e.target.value) : null })} />
                : (trade.take_profit ? `$${trade.take_profit}` : '—')
              } />
              <StatRow label="Fees" value={
                editing ? <Input type="number" step="any" className="h-7 w-24 text-xs bg-secondary" value={form.fees ?? 0} onChange={e => setForm({ ...form, fees: Number(e.target.value) })} />
                : `$${trade.fees ?? 0}`
              } />
              <StatRow label="Strategy" value={
                editing ? (
                  <Select value={form.strategy ?? ''} onValueChange={v => setForm({ ...form, strategy: v })}>
                    <SelectTrigger className="h-7 w-36 text-xs bg-secondary">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {strategyOptions.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (trade.strategy || '—')
              } />

              <div className="border-t border-border pt-2 mt-2">
                <StatRow label="Entry" value={
                  editing ? <Input type="datetime-local" className="h-7 w-44 text-xs bg-secondary" value={form.entry_date?.slice(0, 16)} onChange={e => setForm({ ...form, entry_date: new Date(e.target.value).toISOString() })} />
                  : format(parseISO(trade.entry_date), 'MMM dd, yyyy HH:mm')
                } />
                <StatRow label="Exit" value={
                  editing ? <Input type="datetime-local" className="h-7 w-44 text-xs bg-secondary" value={form.exit_date?.slice(0, 16) ?? ''} onChange={e => setForm({ ...form, exit_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                  : (trade.exit_date ? format(parseISO(trade.exit_date), 'MMM dd, yyyy HH:mm') : '—')
                } />
              </div>

              {(trade.tags ?? []).length > 0 && (
                <div className="pt-2">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {(trade.tags ?? []).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] bg-primary/10 text-primary">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Chart + Tabs */}
          <div className="flex-1 p-5 space-y-4 min-w-0">
            <TradingViewWidget
              symbol={trade.symbol}
              assetType={trade.asset_type ?? undefined}
              entryPrice={trade.entry_price}
              exitPrice={trade.exit_price}
              entryDate={trade.entry_date}
              exitDate={trade.exit_date}
              direction={trade.direction}
              tradeId={trade.id}
              stopLoss={trade.stop_loss}
              takeProfit={trade.take_profit}
            />

            <Tabs defaultValue="notes">
              <TabsList className="bg-secondary border border-border">
                <TabsTrigger value="notes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">Notes</TabsTrigger>
                <TabsTrigger value="psych" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">🧠 ניתוח פסיכולוגי</TabsTrigger>
                <TabsTrigger value="executions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">Executions</TabsTrigger>
                <TabsTrigger value="attachments" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">Attachments</TabsTrigger>
              </TabsList>

              <TabsContent value="notes">
                {editing ? (
                  <Textarea value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-secondary" rows={4} placeholder="Trade notes..." />
                ) : (
                  trade.notes ? <p className="text-sm bg-secondary rounded-lg p-3">{trade.notes}</p>
                  : <p className="text-sm text-muted-foreground py-4 text-center">No notes</p>
                )}
              </TabsContent>

              <TabsContent value="psych">
                <PsychAnalysis trade={trade} />
              </TabsContent>

              <TabsContent value="executions">
                <TradeExecutions tradeId={trade.id} tradeEntryDate={trade.entry_date} />
              </TabsContent>

              <TabsContent value="attachments">
                <ScreenshotUpload tradeId={trade.id} currentUrl={trade.screenshot_url} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

function PsychAnalysis({ trade }: { trade: Trade }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('trade-journal-ai', {
        body: { trade, mode: 'psych' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.summary);
    } catch (e: any) {
      setError(e.message || 'Failed to generate analysis');
    } finally {
      setLoading(false);
    }
  };

  const hasNotes = !!(trade.notes || trade.strategy || (trade.tags && trade.tags.length));

  return (
    <div className="space-y-3" dir="rtl">
      {!hasNotes && (
        <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3">
          הוסף הערות, אסטרטגיה או תגיות לעסקה כדי לקבל ניתוח פסיכולוגי איכותי על מה שכתבת.
        </p>
      )}
      <div className="flex justify-end">
        <Button size="sm" onClick={run} disabled={loading}>
          {loading ? 'מנתח...' : analysis ? 'נתח שוב' : '🧠 נתח פסיכולוגית'}
        </Button>
      </div>
      {error && <p className="text-xs text-[hsl(var(--chart-red))]">{error}</p>}
      {analysis && (
        <div className="bg-secondary/50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
          {analysis}
        </div>
      )}
    </div>
  );
}
