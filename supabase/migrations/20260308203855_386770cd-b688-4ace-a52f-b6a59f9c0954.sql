
CREATE TABLE public.session_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  bias text DEFAULT 'neutral',
  key_levels text DEFAULT '',
  watchlist text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.session_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON public.session_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.session_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.session_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.session_plans FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.rule_violations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  trade_id uuid,
  violation_type text NOT NULL DEFAULT 'other',
  description text,
  severity text NOT NULL DEFAULT 'medium',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.rule_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own violations" ON public.rule_violations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own violations" ON public.rule_violations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own violations" ON public.rule_violations FOR DELETE USING (auth.uid() = user_id);
