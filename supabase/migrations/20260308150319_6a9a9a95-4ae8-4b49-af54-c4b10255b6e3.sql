CREATE TABLE public.options_sentiment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  sentiment text NOT NULL DEFAULT 'neutral',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT options_sentiment_user_week_unique UNIQUE (user_id, week_start)
);

ALTER TABLE public.options_sentiment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own options sentiment" ON public.options_sentiment FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own options sentiment" ON public.options_sentiment FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own options sentiment" ON public.options_sentiment FOR UPDATE TO authenticated USING (auth.uid() = user_id);