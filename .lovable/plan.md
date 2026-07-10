
## Goal
Let users wipe their personal data (start fresh) or fully delete their account, from Settings on both the web app and the iOS native app.

## Scope of "Erase all data"
Wipes rows owned by the current user in:
- `daily_entries`, `habits_log`
- `meals`, `meal_presets`, `weight_entries`
- `user_supplements`, `chat_threads` (cascades `chat_messages`), `pinned_insights`
- `profiles`: resets baseline (DOB, sex, height, weight, resting HR) and targets (kcal, macros, sleep target, activity, goal) back to null; keeps the row + display name so auth still works

Left untouched: `groups` / `group_members` (user stays in their groups), `device_tokens`.

"Delete account" = erase all of the above **plus** remove group memberships, then delete the `auth.users` record (cascades `profiles`), then sign out.

## Backend
New server functions in `src/lib/account.functions.ts`, both `.middleware([requireSupabaseAuth])`:

1. `eraseMyData()` — runs deletes scoped to `context.userId` via the authenticated `supabase` client (RLS enforces ownership), then updates `profiles` to null-out baseline/targets. Returns `{ ok: true }`.
2. `deleteMyAccount()` — calls the erase logic, deletes `group_members` rows for the user, then dynamic-imports `supabaseAdmin` and calls `auth.admin.deleteUser(userId)`. Returns `{ ok: true }`.

No schema migration needed — RLS policies already allow users to delete their own rows.

## Web UI (`src/routes/_authenticated/settings.tsx`)
New "Danger zone" card at the bottom with two destructive buttons:
- **Erase all data** — opens AlertDialog requiring the user to type `ERASE` to confirm. On success: toast, invalidate all queries, navigate to `/`.
- **Delete account** — opens AlertDialog requiring the user to type `DELETE`. On success: sign out and redirect to `/auth`.

Uses `useServerFn` + existing shadcn `AlertDialog`.

## iOS UI (`ios-native/WhoopCompanion/Features/Settings/SettingsView.swift`)
New "Danger Zone" section with two rows:
- **Erase all data** → confirmation alert → calls the server fn via `APIClient` (add `eraseMyData()` + `deleteMyAccount()` wrappers that POST to the server-fn endpoints using the current bearer token).
- **Delete account** → confirmation alert → calls server fn → `SessionStore.signOut()`.

Since the iOS app already talks to server functions elsewhere via `APIClient`, follow the same pattern (or, if simpler, expose these as `/api/public/ios/erase-data` and `/api/public/ios/delete-account` routes that verify the bearer token — matching the existing `api/public/ios/*` pattern used by the iOS app).

## Technical notes
- All deletes are scoped by `user_id = context.userId`; RLS is the safety net.
- `chat_messages` is removed via `chat_threads` cascade if present, otherwise deleted explicitly first.
- `deleteMyAccount` requires `supabaseAdmin` (service role) only for the final `auth.admin.deleteUser` call.
- The erase server fn is idempotent and safe to retry.

## Out of scope
- Group ownership transfer / deletion
- Undo / soft-delete / grace period
- Exporting data as part of the flow (existing Export button already covers that)
