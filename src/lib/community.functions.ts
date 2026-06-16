import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";


const NameSchema = z.string().trim().min(1).max(60);
const IconSchema = z.string().trim().max(8).optional();
const CodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/);
const UuidSchema = z.string().uuid();

// Wrap raw Postgres errors so internal schema details don't leak to the client.
function dbFail(op: string, err: { message?: string; code?: string } | null): never {
  console.error(`[community.${op}]`, err);
  throw new Error("Something went wrong. Please try again.");
}


export const getMyGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: memberships, error: mErr } = await supabase
      .from("group_members")
      .select("group_id, role, joined_at")
      .eq("user_id", userId);
    if (mErr) throw new Error(mErr.message);
    if (!memberships?.length) return [];
    const ids = memberships.map((m) => m.group_id);
    const { data: groups, error: gErr } = await supabase
      .from("groups")
      .select("id, name, icon, invite_code, created_by")
      .in("id", ids);
    if (gErr) throw new Error(gErr.message);
    return (groups ?? []).map((g) => ({
      ...g,
      role: memberships.find((m) => m.group_id === g.id)?.role ?? "member",
    }));
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; icon?: string }) =>
    z.object({ name: NameSchema, icon: IconSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: group, error } = await supabase
      .from("groups")
      .insert({ name: data.name, icon: data.icon || "👥", created_by: userId })
      .select("id, name, icon, invite_code, created_by")
      .single();
    if (error) throw new Error(error.message);
    const { error: memErr } = await supabase
      .from("group_members")
      .insert({ group_id: group.id, user_id: userId, role: "owner" });
    if (memErr) throw new Error(memErr.message);
    return group;
  });

export const previewGroupByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => z.object({ code: CodeSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: group, error } = await supabaseAdmin
      .from("groups")
      .select("id, name, icon, invite_code")
      .eq("invite_code", data.code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!group) throw new Error("Invite code not found");
    const { count } = await supabaseAdmin
      .from("group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id);
    const { data: existing } = await supabaseAdmin
      .from("group_members")
      .select("id")
      .eq("group_id", group.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    return { ...group, member_count: count ?? 0, already_member: !!existing };
  });

export const joinGroupByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => z.object({ code: CodeSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: group, error } = await supabaseAdmin
      .from("groups")
      .select("id, name, icon")
      .eq("invite_code", data.code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!group) throw new Error("Invite code not found");
    const { error: insErr } = await supabase
      .from("group_members")
      .insert({ group_id: group.id, user_id: userId, role: "member" });
    if (insErr && !insErr.message.includes("duplicate")) throw new Error(insErr.message);
    return group;
  });

export const getGroupLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { groupId: string }) => z.object({ groupId: UuidSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: group, error: gErr } = await supabase
      .from("groups")
      .select("id, name, icon, invite_code, created_by")
      .eq("id", data.groupId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!group) throw new Error("Group not found");
    const { data: rows, error } = await supabase.rpc("group_leaderboard", {
      _group_id: data.groupId,
    });
    if (error) throw new Error(error.message);
    return { group, rows: rows ?? [], me: context.userId };
  });

export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { groupId: string }) => z.object({ groupId: UuidSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", data.groupId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type AuthedSupabase = SupabaseClient<Database>;


async function assertOwner(
  supabase: AuthedSupabase,
  groupId: string,
  userId: string,
) {
  const { data, error } = await supabase.rpc("is_group_owner", {
    _group_id: groupId,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: only the group owner can do that");
}


export const renameGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { groupId: string; name: string; icon?: string }) =>
    z.object({ groupId: UuidSchema, name: NameSchema, icon: IconSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.groupId, userId);
    const { error } = await supabase
      .from("groups")
      .update({ name: data.name, icon: data.icon || "👥" })
      .eq("id", data.groupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const regenerateInviteCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { groupId: string }) => z.object({ groupId: UuidSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.groupId, userId);
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const { error } = await supabase
      .from("groups")
      .update({ invite_code: code })
      .eq("id", data.groupId);
    if (error) throw new Error(error.message);
    return { invite_code: code };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { groupId: string; userId: string }) =>
    z.object({ groupId: UuidSchema, userId: UuidSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.groupId, userId);
    if (data.userId === userId) {
      throw new Error("Owners cannot remove themselves. Transfer ownership or delete the group.");
    }
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", data.groupId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { groupId: string }) => z.object({ groupId: UuidSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.groupId, userId);
    const { error } = await supabase.from("groups").delete().eq("id", data.groupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

