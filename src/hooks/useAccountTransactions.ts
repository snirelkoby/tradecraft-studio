import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface AccountTransaction {
  id: string;
  user_id: string;
  account_id: string;
  type: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export function useAccountTransactions(accountId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['account_transactions', user?.id, accountId],
    queryFn: async () => {
      let query = supabase
        .from('account_transactions')
        .select('*')
        .order('created_at', { ascending: false });
      if (accountId) query = query.eq('account_id', accountId);
      const { data, error } = await query;
      if (error) throw error;
      return data as AccountTransaction[];
    },
    enabled: !!user,
  });
}

export function useAllAccountTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['account_transactions', user?.id, 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_transactions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AccountTransaction[];
    },
    enabled: !!user,
  });
}

export function useAddTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (tx: { account_id: string; type: string; amount: number; note?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('account_transactions')
        .insert({ ...tx, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account_transactions'] }),
  });
}
