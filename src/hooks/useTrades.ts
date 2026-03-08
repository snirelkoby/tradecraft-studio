import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';
import { FUTURES_CONFIG } from '@/lib/assetConfig';

type Trade = Database['public']['Tables']['trades']['Row'];
type TradeInsert = Database['public']['Tables']['trades']['Insert'];

export function useTrades() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['trades', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('entry_date', { ascending: false });
      if (error) throw error;
      return data as Trade[];
    },
    enabled: !!user,
  });
}

export function useAddTrade() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (trade: Omit<TradeInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('trades')
        .insert({ ...trade, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trades'] }),
  });
}

export function useUpdateTrade() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Trade> & { id: string }) => {
      const { data, error } = await supabase
        .from('trades')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trades'] }),
  });
}

export function useDeleteTrade() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trades').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trades'] }),
  });
}

export function useBulkDeleteTrades() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('trades').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trades'] }),
  });
}

export function useDeleteAllTrades() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('trades').delete().eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trades'] }),
  });
}

/** Calculate P&L correctly for futures using tick value */
export function calculateFuturesPnl(
  symbol: string,
  direction: 'long' | 'short',
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  fees: number
): { pnl: number; pnlPercent: number } {
  const config = FUTURES_CONFIG.find(f => f.symbol === symbol);
  if (!config) {
    // Fallback to standard calculation
    const raw = direction === 'long'
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;
    return { pnl: raw - fees, pnlPercent: ((exitPrice - entryPrice) / entryPrice) * 100 * (direction === 'short' ? -1 : 1) };
  }

  const ticks = (exitPrice - entryPrice) / config.tickSize;
  const rawPnl = direction === 'long'
    ? ticks * config.tickValue * quantity
    : -ticks * config.tickValue * quantity;

  return {
    pnl: rawPnl - fees,
    pnlPercent: ((exitPrice - entryPrice) / entryPrice) * 100 * (direction === 'short' ? -1 : 1),
  };
}

// Analytics helpers
export function useTradeStats(trades: Trade[] | undefined) {
  if (!trades || trades.length === 0) {
    return {
      totalPnl: 0, winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0,
      totalTrades: 0, wins: 0, losses: 0, bestTrade: 0, worstTrade: 0, avgRR: 0,
    };
  }

  const closed = trades.filter((t) => t.status === 'closed' && t.pnl !== null);
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0);

  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossProfit = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));

  return {
    totalPnl,
    winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    bestTrade: closed.length > 0 ? Math.max(...closed.map((t) => t.pnl ?? 0)) : 0,
    worstTrade: closed.length > 0 ? Math.min(...closed.map((t) => t.pnl ?? 0)) : 0,
    avgRR: wins.length > 0 && losses.length > 0
      ? (grossProfit / wins.length) / (grossLoss / losses.length)
      : 0,
  };
}
