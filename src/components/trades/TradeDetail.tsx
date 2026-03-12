import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TradingViewWidget } from './TradingViewWidget';
import { ScreenshotUpload } from './ScreenshotUpload';
import { TradeExecutions } from './TradeExecutions';
import { TrendingUp, TrendingDown, Edit3, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useUpdateTrade } from '@/hooks/useTrades';
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
  const updateTrade = useUpdateTrade();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Trade>>({});

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
    }
  }, [trade]);

  if (!trade) return null;

  // Navigation
  const currentIndex = trades?.findIndex(t => t.id === trade.id) ?? -1;
  const hasPrev = currentIndex > 0;
  const hasNext = trades ? currentIndex < trades.length - 1 : false;
  const goPrev = () => { if (hasPrev && trades && onTradeChange) onTradeChange(trades[currentIndex - 1]); };
  const goNext = () => { if (hasNext && trades && onTradeChange) onTradeChange(trades[currentIndex + 1]); };

  const handleSave = async () => {
    try {
      let pnl = trade.pnl;
      let pnlPercent = trade.pnl_percent;
      const entryPrice = Number(form.entry_price);
      const exitPrice = form.exit_price ? Number(form.exit_price) : null;
      const qty = Number(form.quantity) || 1;
      const fees = Number(form.fees) || 0;
      const dir = form.direction || trade.direction;
      const status = exitPrice ? 'closed' : 'open';

      if (exitPrice) {
        const raw = dir === 'long'
          ? (exitPrice - entryPrice) * qty
          : (entryPrice - exitPrice) * qty;
        pnl = raw - fees;
        pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100 * (dir === 'short' ? -1 : 1);
      }

      await updateTrade.mutateAsync({
        id: trade.id,
        ...form,
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

  const pnl = trade.pnl;
  const pnlColor = pnl !== null ? (pnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]') : '';

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
            <span className="text-xl font-bold">{trade.symbol}</span>
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
              <p className="text-[10px] text-muted-foreground uppercase">Net P&L</p>
              <p className={`text-2xl font-bold font-mono ${pnlColor}`}>
                {pnl !== null ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : '—'}
              </p>
              {trade.pnl_percent !== null && (
                <p className={`text-sm font-mono ${pnlColor}`}>{trade.pnl_percent.toFixed(2)}%</p>
              )}
            </div>

            <div className="space-y-2.5 text-sm">
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
              <StatRow label="Strategy" value={trade.strategy || '—'} />

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
            />

            <Tabs defaultValue="notes">
              <TabsList className="bg-secondary border border-border">
                <TabsTrigger value="notes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">Notes</TabsTrigger>
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
