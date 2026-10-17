CREATE TABLE public.whoop_webhook_events (
 trace_id text PRIMARY KEY,
 whoop_user_id text NOT NULL,
 event_type text NOT NULL,
 resource_id text NOT NULL,
 processed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whoop_webhook_events TO service_role;
ALTER TABLE public.whoop_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.whoop_sleep_imports (
 user_id uuid NOT NULL REFERENCES public.whoop_connections(user_id) ON DELETE CASCADE,
 sleep_id text NOT NULL,
 entry_date date NOT NULL,
 values jsonb NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY (user_id, sleep_id)
);
GRANT ALL ON public.whoop_sleep_imports TO service_role;
ALTER TABLE public.whoop_sleep_imports ENABLE ROW LEVEL SECURITY;
CREATE INDEX whoop_sleep_imports_date_idx ON public.whoop_sleep_imports(user_id, entry_date);
CREATE INDEX whoop_connections_whoop_id_idx ON public.whoop_connections(whoop_user_id);