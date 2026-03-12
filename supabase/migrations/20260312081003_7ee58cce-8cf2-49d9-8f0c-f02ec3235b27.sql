ALTER TABLE public.blueprints DROP CONSTRAINT IF EXISTS blueprints_user_id_tier_key;

CREATE INDEX IF NOT EXISTS idx_blueprints_user_id_tier ON public.blueprints (user_id, tier);