
-- Account transactions for deposits/withdrawals
CREATE TABLE public.account_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'deposit',
  amount numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.account_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.account_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.account_transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Macro saved indicators (persist user inputs)
CREATE TABLE public.macro_saved_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  indicators jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.macro_saved_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own macro" ON public.macro_saved_indicators FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own macro" ON public.macro_saved_indicators FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own macro" ON public.macro_saved_indicators FOR UPDATE TO authenticated USING (auth.uid() = user_id);
