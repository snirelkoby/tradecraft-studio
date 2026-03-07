
-- Add name field to blueprints
ALTER TABLE public.blueprints ADD COLUMN IF NOT EXISTS name text DEFAULT '';

-- Add asset_type to trades
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS asset_type text DEFAULT 'stock';

-- Create storage bucket for trade screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('trade-screenshots', 'trade-screenshots', true) ON CONFLICT DO NOTHING;

-- RLS for storage: users can upload their own screenshots
CREATE POLICY "Users can upload screenshots" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'trade-screenshots');
CREATE POLICY "Users can view screenshots" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'trade-screenshots');
CREATE POLICY "Users can delete own screenshots" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'trade-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
