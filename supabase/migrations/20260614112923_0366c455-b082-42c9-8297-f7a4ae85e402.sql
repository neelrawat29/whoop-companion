
-- Helper: random invite code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- GROUPS
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  icon text DEFAULT '👥',
  invite_code text NOT NULL UNIQUE DEFAULT public.generate_invite_code(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_groups_invite_code ON public.groups(invite_code);
CREATE INDEX idx_groups_created_by ON public.groups(created_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- GROUP MEMBERS
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_user ON public.group_members(user_id);
CREATE INDEX idx_group_members_group ON public.group_members(group_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Security-definer membership check (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id AND role = 'owner'
  );
$$;

-- Updated-at trigger for groups
CREATE TRIGGER groups_set_updated_at
BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: GROUPS
CREATE POLICY "members can view their groups"
ON public.groups FOR SELECT
TO authenticated
USING (public.is_group_member(id, auth.uid()));

CREATE POLICY "authenticated can create groups"
ON public.groups FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "owners can update their group"
ON public.groups FOR UPDATE
TO authenticated
USING (public.is_group_owner(id, auth.uid()))
WITH CHECK (public.is_group_owner(id, auth.uid()));

CREATE POLICY "owners can delete their group"
ON public.groups FOR DELETE
TO authenticated
USING (public.is_group_owner(id, auth.uid()));

-- RLS: GROUP MEMBERS
CREATE POLICY "members can view co-members"
ON public.group_members FOR SELECT
TO authenticated
USING (public.is_group_member(group_id, auth.uid()));

-- Users insert themselves (the server-fn will validate invite_code before calling)
CREATE POLICY "users can join groups as themselves"
ON public.group_members FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Owners can remove anyone; users can remove themselves (leave)
CREATE POLICY "owner or self can delete membership"
ON public.group_members FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_group_owner(group_id, auth.uid())
);

-- LEADERBOARD: aggregated per-member stats, visible only to fellow members
CREATE OR REPLACE FUNCTION public.group_leaderboard(_group_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  days_logged_7d int,
  current_streak int,
  avg_recovery_7d numeric,
  avg_sleep_hours_7d numeric,
  avg_energy_7d numeric,
  avg_mood_7d numeric,
  logged_today boolean,
  is_owner boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be a member
  IF NOT public.is_group_member(_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  RETURN QUERY
  WITH members AS (
    SELECT gm.user_id, gm.role
    FROM public.group_members gm
    WHERE gm.group_id = _group_id
  ),
  recent AS (
    SELECT de.user_id,
           COUNT(DISTINCT de.entry_date) FILTER (WHERE de.entry_date >= CURRENT_DATE - 6) AS days7,
           AVG(de.recovery) FILTER (WHERE de.entry_date >= CURRENT_DATE - 6) AS rec7,
           AVG(de.sleep_hours) FILTER (WHERE de.entry_date >= CURRENT_DATE - 6) AS sleep7,
           BOOL_OR(de.entry_date = CURRENT_DATE) AS today
    FROM public.daily_entries de
    WHERE de.user_id IN (SELECT user_id FROM members)
      AND de.entry_date >= CURRENT_DATE - 30
    GROUP BY de.user_id
  ),
  habits AS (
    SELECT hl.user_id,
           AVG(hl.energy) FILTER (WHERE hl.entry_date >= CURRENT_DATE - 6) AS energy7,
           AVG(hl.mood) FILTER (WHERE hl.entry_date >= CURRENT_DATE - 6) AS mood7
    FROM public.habits_log hl
    WHERE hl.user_id IN (SELECT user_id FROM members)
      AND hl.entry_date >= CURRENT_DATE - 30
    GROUP BY hl.user_id
  ),
  streaks AS (
    SELECT m.user_id,
      COALESCE((
        SELECT COUNT(*)::int FROM (
          SELECT de2.entry_date,
                 (CURRENT_DATE - de2.entry_date)::int AS diff,
                 ROW_NUMBER() OVER (ORDER BY de2.entry_date DESC) - 1 AS rn
          FROM (SELECT DISTINCT entry_date FROM public.daily_entries WHERE user_id = m.user_id ORDER BY entry_date DESC LIMIT 365) de2
        ) s
        WHERE s.diff = s.rn
      ), 0) AS streak
    FROM members m
  )
  SELECT
    m.user_id,
    COALESCE(p.display_name, 'Member') AS display_name,
    COALESCE(r.days7, 0)::int AS days_logged_7d,
    COALESCE(s.streak, 0) AS current_streak,
    ROUND(r.rec7, 1) AS avg_recovery_7d,
    ROUND(r.sleep7, 1) AS avg_sleep_hours_7d,
    ROUND(h.energy7, 1) AS avg_energy_7d,
    ROUND(h.mood7, 1) AS avg_mood_7d,
    COALESCE(r.today, false) AS logged_today,
    (m.role = 'owner') AS is_owner
  FROM members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN recent r ON r.user_id = m.user_id
  LEFT JOIN habits h ON h.user_id = m.user_id
  LEFT JOIN streaks s ON s.user_id = m.user_id
  ORDER BY current_streak DESC, days_logged_7d DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.group_leaderboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invite_code() TO authenticated;
