import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { FUTURES_CONFIG } from '@/lib/assetConfig';

interface TradeExecutionsProps {
  tradeId: string;
  tradeEntryDate?: string;
  symbol?: string;
  assetType?: string | null;
  entryPrice?: number;
  direction?: string;
}

/**
 * Convert price movement (entry → execution price) into actual $ value
 * for the asset class. For futures, uses tickSize/tickValue. For other
 * asset types, treats it as (priceDelta * quantity).
 */
function movementToDollars(
  symbol: string,
  assetType: string | null | undefined,
  direction: string | undefined,
  entryPrice: number,
  execPrice: number,
  qty: number,
): { delta: number; dollars: number } {
  const dir = direction === 'short' ? -1 : 1;
  const delta = (execPrice - entryPrice) * dir;

  if (assetType === 'Futures') {
    const cfg = FUTURES_CONFIG.find(f => f.symbol === symbol);
    if (cfg) {
      const ticks = (execPrice - entryPrice) / cfg.tickSize;
      const dollars = ticks * cfg.tickValue * qty * dir;
      return { delta, dollars };
    }
  }
  return { delta, dollars: delta * qty };
}

export function TradeExecutions({
  tradeId,
  tradeEntryDate,
  symbol,
  assetType,
  entryPrice,
  direction,
}: TradeExecutionsProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const defaultDate = tradeEntryDate
    ? new Date(tradeEntryDate).toISOString().slice(0, 16)
    : new Date().toISOString().slice(0, 16);

  const [form, setForm] = useState({
    execution_type: 'entry',
    price: '',
    quantity: '1',
    executed_at: defaultDate,
  });

  const { data: executions, isLoading } = useQuery({
    queryKey: ['trade-executions', tradeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_executions')
        .select('*')
        .eq('trade_id', tradeId)
        .order('executed_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addExecution = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('trade_executions').insert({
        trade_id: tradeId,
        user_id: user.id,
        execution_type: form.execution_type,
        price: parseFloat(form.price),
        quantity: parseFloat(form.quantity) || 1,
        executed_at: new Date(form.executed_at).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trade-executions', tradeId] });
      setAdding(false);
      setForm({ execution_type: 'entry', price: '', quantity: '1', executed_at: defaultDate });
      toast.success('Execution added');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteExecution = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trade_executions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trade-executions', tradeId] });
      toast.success('Execution removed');
    },
  });

  // Live preview $ for "add execution" form
  const previewDollars = (() => {
    const p = parseFloat(form.price);
    const q = parseFloat(form.quantity) || 1;
    if (!symbol || entryPrice == null || !p || form.execution_type !== 'exit') return null;
    return movementToDollars(symbol, assetType, direction, entryPrice, p, q).dollars;
  })();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Scale in/out for this trade — exit P&L shown in real $ based on asset type
        </p>
        <Button size="sm" variant="outline" onClick={() => setAdding(!adding)}>
          <Plus className="h-3 w-3 mr-1" />{adding ? 'Cancel' : 'Add Execution'}
        </Button>
      </div>

      {adding && (
        <div className="grid grid-cols-5 gap-2 bg-secondary rounded-lg p-3">
          <Select value={form.execution_type} onValueChange={v => setForm({ ...form, execution_type: v })}>
            <SelectTrigger className="bg-background text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="entry">Entry (Scale In)</SelectItem>
              <SelectItem value="exit">Exit (Scale Out)</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" step="any" placeholder="Price" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="bg-background text-xs" />
          <Input type="number" min="1" placeholder="Qty" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="bg-background text-xs" />
          <Input type="datetime-local" value={form.executed_at} onChange={e => setForm({ ...form, executed_at: e.target.value })} className="bg-background text-xs" />
          <Button size="sm" onClick={() => addExecution.mutate()} disabled={!form.price}>Add</Button>
          {previewDollars !== null && (
            <div className="col-span-5 text-[11px] text-muted-foreground">
              Estimated $ for this scale-out:{' '}
              <span className={`font-mono font-bold ${previewDollars >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                {previewDollars >= 0 ? '+' : ''}${previewDollars.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
      ) : !executions?.length ? (
        <p className="text-xs text-muted-foreground text-center py-4">No additional executions</p>
      ) : (
        <div className="space-y-1">
          {executions.map(ex => {
            const isExit = ex.execution_type === 'exit';
            const calc = symbol && entryPrice != null
              ? movementToDollars(symbol, assetType, direction, entryPrice, Number(ex.price), Number(ex.quantity))
              : null;
            return (
              <div key={ex.id} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2 text-xs">
                <div className="flex items-center gap-3">
                  <span className={`font-bold uppercase ${ex.execution_type === 'entry' ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                    {ex.execution_type}
                  </span>
                  <span className="font-mono">${ex.price}</span>
                  <span className="text-muted-foreground">×{ex.quantity}</span>
                  <span className="text-muted-foreground">{format(parseISO(ex.executed_at), 'MMM dd HH:mm')}</span>
                  {calc && isExit && (
                    <span className={`font-mono font-bold ${calc.dollars >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                      {calc.dollars >= 0 ? '+' : ''}${calc.dollars.toFixed(2)}
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteExecution.mutate(ex.id)}>
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
