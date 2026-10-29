import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const searchPlayers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string }) => z.object({ query: z.string().trim().min(2).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("search_players", { _query: data.query });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });

export const listFriends = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await context.supabase.rpc("list_friends");
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });

export const friendAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { target: string; action: "request" | "accept" | "remove" }) =>
    z.object({ target: z.string().uuid(), action: z.enum(["request", "accept", "remove"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("friend_action", { _target: data.target, _action: data.action });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });