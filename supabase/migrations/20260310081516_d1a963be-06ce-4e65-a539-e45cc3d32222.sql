
-- Create storage bucket for trade screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('trade-screenshots', 'trade-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload trade screenshots" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'trade-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update trade screenshots" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'trade-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete trade screenshots" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'trade-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view trade screenshots" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'trade-screenshots');

-- Trade executions table for scaling in/out
CREATE TABLE public.trade_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid REFERENCES public.trades(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  execution_type text NOT NULL DEFAULT 'entry',
  price numeric NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  executed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own executions" ON public.trade_executions FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
