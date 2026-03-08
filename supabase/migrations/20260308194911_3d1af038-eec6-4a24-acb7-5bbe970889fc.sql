
-- Mindset journal entries
CREATE TABLE public.mindset_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  energy_level INTEGER NOT NULL DEFAULT 5,
  focus_level INTEGER NOT NULL DEFAULT 5,
  confidence_level INTEGER NOT NULL DEFAULT 5,
  mood TEXT DEFAULT 'neutral',
  pre_session_notes TEXT,
  post_session_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mindset_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mindset" ON public.mindset_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mindset" ON public.mindset_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mindset" ON public.mindset_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own mindset" ON public.mindset_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX mindset_user_date_idx ON public.mindset_entries (user_id, date);

-- Achievements table
CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_key TEXT NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_key)
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements" ON public.achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own achievements" ON public.achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
