
CREATE TABLE public.account_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  company_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, symbol)
);

ALTER TABLE public.account_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watchlist" ON public.account_watchlist FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own watchlist" ON public.account_watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own watchlist" ON public.account_watchlist FOR DELETE TO authenticated USING (auth.uid() = user_id);
