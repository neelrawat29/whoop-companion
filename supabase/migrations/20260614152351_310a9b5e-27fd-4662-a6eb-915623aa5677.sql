
-- 1. Replace the permissive insert policy on group_members with one that pins role='member'.
DROP POLICY IF EXISTS "users can join groups as themselves" ON public.group_members;

CREATE POLICY "users can join groups as members"
  ON public.group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'member');

-- 2. Allow the group creator to insert exactly one owner membership row for a group they just created.
CREATE POLICY "creator can insert owner membership"
  ON public.group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'owner'
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

-- 3. Lock down SECURITY DEFINER helpers: only signed-in users may call them; anon cannot.
REVOKE EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.group_leaderboard(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.group_leaderboard(uuid) TO authenticated;
