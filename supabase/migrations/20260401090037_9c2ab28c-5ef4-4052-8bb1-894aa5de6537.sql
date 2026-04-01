
CREATE TABLE public.weekly_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  summary TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_weekly_summaries_user_week ON public.weekly_summaries (user_id, week_start);

CREATE POLICY "Users can view own weekly summaries" ON public.weekly_summaries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weekly summaries" ON public.weekly_summaries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weekly summaries" ON public.weekly_summaries FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own weekly summaries" ON public.weekly_summaries FOR DELETE TO authenticated USING (auth.uid() = user_id);
