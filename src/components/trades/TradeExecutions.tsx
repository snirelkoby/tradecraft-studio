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

interface TradeExecutionsProps {
  tradeId: string;
}

export function TradeExecutions({ tradeId }: TradeExecutionsProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    execution_type: 'entry',
    price: '',
    quantity: '1',
    executed_at: new Date().toISOString().slice(0, 16),
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
      setForm({ execution_type: 'entry', price: '', quantity: '1', executed_at: new Date().toISOString().slice(0, 16) });
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Scale in/out entries for this trade</p>
        <Button size="sm" variant="outline" onClick={() => setAdding(!adding)}>
          <Plus className="h-3 w-3 mr-1" />{adding ? 'Cancel' : 'Add Execution'}
        </Button>
      </div>

      {adding && (
        <div className="grid grid-cols-4 gap-2 bg-secondary rounded-lg p-3">
          <Select value={form.execution_type} onValueChange={v => setForm({ ...form, execution_type: v })}>
            <SelectTrigger className="bg-background text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="entry">Entry (Scale In)</SelectItem>
              <SelectItem value="exit">Exit (Scale Out)</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" step="any" placeholder="Price" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="bg-background text-xs" />
          <Input type="number" min="1" placeholder="Qty" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="bg-background text-xs" />
          <Button size="sm" onClick={() => addExecution.mutate()} disabled={!form.price}>Add</Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
      ) : !executions?.length ? (
        <p className="text-xs text-muted-foreground text-center py-4">No additional executions</p>
      ) : (
        <div className="space-y-1">
          {executions.map(ex => (
            <div key={ex.id} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2 text-xs">
              <div className="flex items-center gap-3">
                <span className={`font-bold uppercase ${ex.execution_type === 'entry' ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                  {ex.execution_type}
                </span>
                <span className="font-mono">${ex.price}</span>
                <span className="text-muted-foreground">×{ex.quantity}</span>
                <span className="text-muted-foreground">{format(parseISO(ex.executed_at), 'MMM dd HH:mm')}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteExecution.mutate(ex.id)}>
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
