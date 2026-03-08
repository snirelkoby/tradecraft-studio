CREATE TABLE public.economic_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_date date NOT NULL,
  event_time time,
  title text NOT NULL,
  currency text DEFAULT 'USD',
  impact text DEFAULT 'medium',
  forecast text,
  actual text,
  previous text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.economic_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events" ON public.economic_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON public.economic_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own events" ON public.economic_events FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own events" ON public.economic_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_economic_events_updated_at BEFORE UPDATE ON public.economic_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();