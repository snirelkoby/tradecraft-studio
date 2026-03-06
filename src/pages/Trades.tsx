import { useState } from 'react';
import { useTrades, useAddTrade, useDeleteTrade } from '@/hooks/useTrades';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const STRATEGIES = ['AAA', 'AA', 'A', 'B', 'C', 'D'];

export default function Trades() {
  const { data: trades, isLoading } = useTrades();
  const addTrade = useAddTrade();
  const deleteTrade = useDeleteTrade();
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    symbol: '',
    direction: 'long' as 'long' | 'short',
    entry_date: new Date().toISOString().split('T')[0],
    exit_date: '',
    entry_price: '',
    exit_price: '',
    stop_loss: '',
    take_profit: '',
    quantity: '1',
    fees: '0',
    strategy: '',
    notes: '',
    status: 'open' as 'open' | 'closed',
  });

  const resetForm = () => {
    setForm({
      symbol: '', direction: 'long', entry_date: new Date().toISOString().split('T')[0],
      exit_date: '', entry_price: '', exit_price: '', stop_loss: '', take_profit: '',
      quantity: '1', fees: '0', strategy: '', notes: '', status: 'open',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entryPrice = parseFloat(form.entry_price);
    const exitPrice = form.exit_price ? parseFloat(form.exit_price) : null;
    const qty = parseFloat(form.quantity) || 1;
    const fees = parseFloat(form.fees) || 0;

    let pnl: number | null = null;
    let pnlPercent: number | null = null;
    const status = exitPrice ? 'closed' : 'open';

    if (exitPrice) {
      const raw = form.direction === 'long'
        ? (exitPrice - entryPrice) * qty
        : (entryPrice - exitPrice) * qty;
      pnl = raw - fees;
      pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100 * (form.direction === 'short' ? -1 : 1);
    }

    try {
      await addTrade.mutateAsync({
        symbol: form.symbol.toUpperCase(),
        direction: form.direction,
        entry_date: new Date(form.entry_date).toISOString(),
        exit_date: form.exit_date ? new Date(form.exit_date).toISOString() : null,
        entry_price: entryPrice,
        exit_price: exitPrice,
        stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
        take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
        quantity: qty,
        fees,
        pnl,
        pnl_percent: pnlPercent,
        strategy: form.strategy || null,
        notes: form.notes || null,
        status,
      });
      toast.success(`Trade ${form.symbol.toUpperCase()} recorded`);
      resetForm();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trade Journal</h1>
          <p className="text-muted-foreground text-sm">Log and manage your trades</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Trade</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle>Record New Trade</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-1 block">Symbol</label>
                  <Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} placeholder="AAPL" required className="bg-secondary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-1 block">Direction</label>
                  <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v as any })}>
                    <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="long">Long</SelectItem>
                      <SelectItem value="short">Short</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-1 block">Entry Date</label>
                  <Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} required className="bg-secondary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-1 block">Exit Date</label>
                  <Input type="date" value={form.exit_date} onChange={(e) => setForm({ ...form, exit_date: e.target.value })} className="bg-secondary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-1 block">Entry Price</label>
                  <Input type="number" step="any" value={form.entry_price} onChange={(e) => setForm({ ...form, entry_price: e.target.value })} required className="bg-secondary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-1 block">Exit Price</label>
                  <Input type="number" step="any" value={form.exit_price} onChange={(e) => setForm({ ...form, exit_price: e.target.value })} className="bg-secondary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-1 block">Stop Loss</label>
                  <Input type="number" step="any" value={form.stop_loss} onChange={(e) => setForm({ ...form, stop_loss: e.target.value })} className="bg-secondary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-1 block">Take Profit</label>
                  <Input type="number" step="any" value={form.take_profit} onChange={(e) => setForm({ ...form, take_profit: e.target.value })} className="bg-secondary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-1 block">Quantity</label>
                  <Input type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="bg-secondary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-1 block">Fees</label>
                  <Input type="number" step="any" value={form.fees} onChange={(e) => setForm({ ...form, fees: e.target.value })} className="bg-secondary" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground uppercase mb-1 block">Strategy</label>
                  <Select value={form.strategy} onValueChange={(v) => setForm({ ...form, strategy: v })}>
                    <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select strategy" /></SelectTrigger>
                    <SelectContent>
                      {STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase mb-1 block">Notes</label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-secondary" rows={3} />
              </div>
              <Button type="submit" className="w-full font-bold" disabled={addTrade.isPending}>
                {addTrade.isPending ? 'Saving...' : 'COMMIT TRADE'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Trades Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <p className="text-center py-12 text-muted-foreground">Loading...</p>
        ) : !trades?.length ? (
          <p className="text-center py-12 text-muted-foreground">No trades recorded yet. Click "New Trade" to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Symbol</TableHead>
                  <TableHead className="text-muted-foreground">Direction</TableHead>
                  <TableHead className="text-muted-foreground">Entry</TableHead>
                  <TableHead className="text-muted-foreground">Exit</TableHead>
                  <TableHead className="text-muted-foreground">SL</TableHead>
                  <TableHead className="text-muted-foreground">TP</TableHead>
                  <TableHead className="text-muted-foreground">P&L</TableHead>
                  <TableHead className="text-muted-foreground">Strategy</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((t) => (
                  <TableRow key={t.id} className="border-border">
                    <TableCell className="font-mono text-xs">{format(parseISO(t.entry_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="font-bold">{t.symbol}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        {t.direction === 'long' ? (
                          <TrendingUp className="h-3 w-3 text-[hsl(var(--chart-green))]" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-[hsl(var(--chart-red))]" />
                        )}
                        <span className="text-xs uppercase">{t.direction}</span>
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">${t.entry_price}</TableCell>
                    <TableCell className="font-mono text-xs">{t.exit_price ? `$${t.exit_price}` : '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{t.stop_loss ? `$${t.stop_loss}` : '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{t.take_profit ? `$${t.take_profit}` : '—'}</TableCell>
                    <TableCell>
                      {t.pnl !== null ? (
                        <span className={`font-mono font-bold text-sm ${t.pnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                          {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {t.strategy && <Badge variant="secondary" className="text-xs">{t.strategy}</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.status === 'open' ? 'default' : 'secondary'} className="text-xs">
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Delete this trade?')) {
                            deleteTrade.mutate(t.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
