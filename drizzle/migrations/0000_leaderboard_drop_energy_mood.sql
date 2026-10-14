CREATE OR REPLACE FUNCTION public.group_leaderboard(_group_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, days_logged_7d integer, current_streak integer, avg_recovery_7d numeric, avg_sleep_hours_7d numeric, avg_energy_7d numeric, avg_mood_7d numeric, logged_today boolean, is_owner boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_group_member(_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  RETURN QUERY
  WITH members AS (
    SELECT gm.user_id, gm.role FROM public.group_members gm WHERE gm.group_id = _group_id
  ),
  recent AS (
    SELECT de.user_id,
           COUNT(DISTINCT de.entry_date) FILTER (WHERE de.entry_date >= CURRENT_DATE - 6) AS days7,
           AVG(de.recovery) FILTER (WHERE de.entry_date >= CURRENT_DATE - 6) AS rec7,
           AVG(de.sleep_hours) FILTER (WHERE de.entry_date >= CURRENT_DATE - 6) AS sleep7,
           BOOL_OR(de.entry_date = CURRENT_DATE) AS today
    FROM public.daily_entries de
    WHERE de.user_id IN (SELECT user_id FROM members) AND de.entry_date >= CURRENT_DATE - 30
    GROUP BY de.user_id
  ),
  streaks AS (
    SELECT m.user_id,
      COALESCE((
        SELECT COUNT(*)::int FROM (
          SELECT de2.entry_date, (CURRENT_DATE - de2.entry_date)::int AS diff,
                 ROW_NUMBER() OVER (ORDER BY de2.entry_date DESC) - 1 AS rn
          FROM (SELECT DISTINCT entry_date FROM public.daily_entries WHERE user_id = m.user_id ORDER BY entry_date DESC LIMIT 365) de2
        ) s WHERE s.diff = s.rn
      ), 0) AS streak
    FROM members m
  )
  SELECT
    m.user_id,
    COALESCE(p.display_name, 'Member') AS display_name,
    COALESCE(r.days7, 0)::int,
    COALESCE(s.streak, 0),
    ROUND(r.rec7, 1),
    ROUND(r.sleep7, 1),
    NULL::numeric,  -- energy no longer tracked (kept for API compatibility)
    NULL::numeric,  -- mood no longer tracked (kept for API compatibility)
    COALESCE(r.today, false),
    (m.role = 'owner')
  FROM members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN recent r ON r.user_id = m.user_id
  LEFT JOIN streaks s ON s.user_id = m.user_id
  ORDER BY 4 DESC, 3 DESC;
END;
$function$;

COMMENT ON COLUMN public.habits_log.energy IS 'DEPRECATED: no longer logged or used; past values preserved.';
COMMENT ON COLUMN public.habits_log.mood IS 'DEPRECATED: no longer logged or used; past values preserved.';