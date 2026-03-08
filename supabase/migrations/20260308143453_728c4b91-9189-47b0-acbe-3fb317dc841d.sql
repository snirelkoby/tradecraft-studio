
CREATE TABLE public.cot_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  report_date date NOT NULL,
  nc_long integer NOT NULL DEFAULT 0,
  nc_short integer NOT NULL DEFAULT 0,
  nc_net integer NOT NULL DEFAULT 0,
  nc_long_change integer NOT NULL DEFAULT 0,
  nc_short_change integer NOT NULL DEFAULT 0,
  open_interest integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol, report_date)
);

ALTER TABLE public.cot_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cot history" ON public.cot_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cot history" ON public.cot_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
