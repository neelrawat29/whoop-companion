## Community Feature Plan

A lightweight social layer that motivates daily logging by ranking friends on a shared streak/consistency leaderboard. Designed to feel like a single, focused tab — not a full social network.

### User experience

1. **New "Community" tab** added to the main nav (alongside existing logging screens).
2. **Empty state**: friendly prompt with two big actions — *Create a group* or *Join with code*.
3. **Create group**: name + optional emoji/icon → instantly generates a short 6-character invite code (e.g. `K7B2QX`) and a shareable link. One-tap copy.
4. **Join group**: paste code or open invite link → preview group name + member count → confirm join.
5. **Group view** (the core screen):
   - Header: group name, member count, invite/share button.
   - **Leaderboard** with three toggleable views:
     - *Current streak* (consecutive days logged)
     - *7-day consistency* (days logged out of last 7)
     - *7-day avg recovery*
   - Each row: avatar/initial, display name, the metric, and a subtle "logged today ✓" indicator.
   - Your own row is highlighted.
6. **Multi-group**: a horizontal group switcher at the top of the Community tab. Users can be in many groups; switching is instant.
7. **Group settings** (creator only): rename, regenerate invite code, remove member, delete group. Members can leave anytime.

### Privacy model

Members see only an aggregated **Recovery + Habits summary** per user:
- Display name + avatar initial
- Current logging streak & 7-day consistency
- 7-day average recovery, sleep hours, energy, mood
- Whether they logged today (boolean)

Members never see meals, notes, individual day values, exact times, or supplements.

### Data model (technical)

Three new tables:

- `groups` — `id`, `name`, `icon`, `invite_code` (unique, indexed), `created_by`, timestamps
- `group_members` — `id`, `group_id`, `user_id`, `role` ('owner' | 'member'), `joined_at`; unique on (group_id, user_id)
- (Reuse existing `profiles` for display_name)

A `SECURITY DEFINER` function `is_group_member(group_id, user_id)` avoids RLS recursion when checking membership.

A `SECURITY DEFINER` view/function `group_leaderboard(group_id)` returns the aggregated summary per member, computed server-side from `daily_entries` + `habits_log` — so RLS on those raw tables stays strict (`auth.uid() = user_id`) while the leaderboard can read across members.

RLS policies:
- `groups`: members can SELECT; only owner can UPDATE/DELETE; any authenticated user can INSERT (becomes owner).
- `group_members`: members can SELECT rows of their groups; users can INSERT themselves via the join server function (which validates the invite code); owners can DELETE any row; users can DELETE their own row (leave).

### Server functions

- `createGroup({ name, icon })` → creates group, adds creator as owner, returns group + invite code.
- `joinGroupByCode({ code })` → looks up group by code, inserts membership, returns group.
- `getMyGroups()` → list of groups the user belongs to.
- `getGroupLeaderboard({ groupId })` → calls the security-definer function; returns aggregated rows.
- `regenerateInviteCode({ groupId })` / `renameGroup` / `removeMember` / `leaveGroup` / `deleteGroup`.

### Routes (TanStack Start)

- `src/routes/_authenticated/community.tsx` — layout + group switcher + outlet
- `src/routes/_authenticated/community.index.tsx` — empty state / group picker landing
- `src/routes/_authenticated/community.$groupId.tsx` — leaderboard view
- `src/routes/_authenticated/community.join.$code.tsx` — invite-link landing (preview + confirm join)
- `src/routes/_authenticated/community.$groupId.settings.tsx` — group settings (owner)

All read paths use `createServerFn` + TanStack Query (`ensureQueryData` in loader, `useSuspenseQuery` in component) per project conventions.

### Out of scope (deliberately, for streamlined UX)

- No chat, comments, reactions, or activity feed
- No notifications (can be added later)
- No public/discoverable groups
- No email invites (link/code only, per your choice)

### Implementation order

1. Database migration (tables, RLS, GRANTs, security-definer helpers).
2. Server functions.
3. Community routes + leaderboard UI.
4. Nav entry + empty states.
5. Quick manual smoke test of create → invite → join → leaderboard flow before publishing.
