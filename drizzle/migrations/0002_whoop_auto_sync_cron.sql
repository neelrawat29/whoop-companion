CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.internal_cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.internal_cron_tokens TO service_role;
ALTER TABLE public.internal_cron_tokens ENABLE ROW LEVEL SECURITY;
INSERT INTO public.internal_cron_tokens (name) VALUES ('whoop_sync') ON CONFLICT DO NOTHING;

SELECT cron.schedule(
  'whoop-auto-sync',
  '15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--603412a2-6b56-45ee-9ba4-200bab1c07f1.lovable.app/api/public/whoop/cron',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token',
      (SELECT token FROM public.internal_cron_tokens WHERE name = 'whoop_sync')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);