import { useState } from 'react';
import { useAddTrade } from '@/hooks/useTrades';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ASSET_TYPES, FUTURES_CONFIG, FOREX_PAIRS, CRYPTO_SYMBOLS } from '@/lib/assetConfig';

const STRATEGIES = ['AAA', 'AA', 'A', 'B', 'C', 'D'];

interface TradeFormProps {
  onSuccess: () => void;
}

export function TradeForm({ onSuccess }: TradeFormProps) {
  const addTrade = useAddTrade();
  const [form, setForm] = useState({
    asset_type: 'Futures' as string,
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
  });

  const getSymbolOptions = () => {
    switch (form.asset_type) {
      case 'Futures': return FUTURES_CONFIG.map(f => ({ value: f.symbol, label: `${f.symbol} — ${f.name}` }));
      case 'Forex': return FOREX_PAIRS.map(p => ({ value: p, label: p }));
      case 'Crypto': return CRYPTO_SYMBOLS.map(s => ({ value: s, label: s }));
      default: return [];
    }
  };

  const symbolOptions = getSymbolOptions();
  const isManualSymbol = form.asset_type === 'Stocks';

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
        asset_type: form.asset_type,
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
      } as any);
      toast.success(`Trade ${form.symbol.toUpperCase()} recorded`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Asset Type Selection */}
      <div>
        <label className="text-xs text-muted-foreground uppercase mb-2 block">Asset Type</label>
        <div className="grid grid-cols-4 gap-2">
          {ASSET_TYPES.map(type => (
            <Button
              key={type}
              type="button"
              variant={form.asset_type === type ? 'default' : 'secondary'}
              className="font-bold text-xs"
              onClick={() => setForm({ ...form, asset_type: type, symbol: '' })}
            >
              {type === 'Futures' ? '📈 Futures' : type === 'Stocks' ? '🏛️ Stocks' : type === 'Crypto' ? '₿ Crypto' : '💱 Forex'}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Symbol */}
        <div>
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Symbol</label>
          {isManualSymbol ? (
            <Input value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value })} placeholder="AAPL" required className="bg-secondary" />
          ) : (
            <Select value={form.symbol} onValueChange={v => setForm({ ...form, symbol: v })}>
              <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select symbol" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {symbolOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Direction</label>
          <Select value={form.direction} onValueChange={v => setForm({ ...form, direction: v as any })}>
            <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="long">Long</SelectItem>
              <SelectItem value="short">Short</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Entry Date</label>
          <Input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} required className="bg-secondary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Exit Date</label>
          <Input type="date" value={form.exit_date} onChange={e => setForm({ ...form, exit_date: e.target.value })} className="bg-secondary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Entry Price</label>
          <Input type="number" step="any" value={form.entry_price} onChange={e => setForm({ ...form, entry_price: e.target.value })} required className="bg-secondary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Exit Price</label>
          <Input type="number" step="any" value={form.exit_price} onChange={e => setForm({ ...form, exit_price: e.target.value })} className="bg-secondary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Stop Loss</label>
          <Input type="number" step="any" value={form.stop_loss} onChange={e => setForm({ ...form, stop_loss: e.target.value })} className="bg-secondary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Take Profit</label>
          <Input type="number" step="any" value={form.take_profit} onChange={e => setForm({ ...form, take_profit: e.target.value })} className="bg-secondary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Quantity</label>
          <Input type="number" step="any" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="bg-secondary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Fees</label>
          <Input type="number" step="any" value={form.fees} onChange={e => setForm({ ...form, fees: e.target.value })} className="bg-secondary" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground uppercase mb-1 block">Strategy</label>
          <Select value={form.strategy} onValueChange={v => setForm({ ...form, strategy: v })}>
            <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select strategy" /></SelectTrigger>
            <SelectContent>
              {STRATEGIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground uppercase mb-1 block">Notes</label>
        <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-secondary" rows={3} />
      </div>
      <Button type="submit" className="w-full font-bold" disabled={addTrade.isPending}>
        {addTrade.isPending ? 'Saving...' : 'COMMIT TRADE'}
      </Button>
    </form>
  );
}
