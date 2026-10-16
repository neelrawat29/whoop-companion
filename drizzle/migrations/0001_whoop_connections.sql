CREATE TABLE public.whoop_connections (
  user_id uuid PRIMARY KEY,
  whoop_user_id text,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  scope text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whoop_connections TO service_role;
ALTER TABLE public.whoop_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.whoop_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL,
  redirect_uri text NOT NULL,
  return_to text NOT NULL DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whoop_oauth_states TO service_role;
ALTER TABLE public.whoop_oauth_states ENABLE ROW LEVEL SECURITY;