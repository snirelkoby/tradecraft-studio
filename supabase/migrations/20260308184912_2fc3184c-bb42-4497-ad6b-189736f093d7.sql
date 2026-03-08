
-- Trade Steps for Trade Replay
CREATE TABLE public.trade_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID NOT NULL,
  user_id UUID NOT NULL,
  step_number INTEGER NOT NULL DEFAULT 1,
  step_type TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  description TEXT,
  screenshot_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trade steps" ON public.trade_steps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trade steps" ON public.trade_steps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trade steps" ON public.trade_steps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trade steps" ON public.trade_steps FOR DELETE USING (auth.uid() = user_id);

-- Trade Mistakes for Mistake Tracker
CREATE TABLE public.trade_mistakes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_mistakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mistakes" ON public.trade_mistakes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mistakes" ON public.trade_mistakes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mistakes" ON public.trade_mistakes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own mistakes" ON public.trade_mistakes FOR DELETE USING (auth.uid() = user_id);

-- Add broker column to trades for commission tracking
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS broker TEXT DEFAULT NULL;
