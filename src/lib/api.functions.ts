/**
 * Client-callable RPC surface. Every handler is authenticated and delegates to
 * the server-only game runtime — no gameplay rule lives on the client.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const core = () => import("./game/core.server");

const settingsSchema = z
  .object({
    mafiaCount: z.number().int().min(1).max(7).optional(),
    detective: z.boolean().optional(),
    doctor: z.boolean().optional(),
    nightSeconds: z.number().int().min(15).max(120).optional(),
    discussionSeconds: z.number().int().min(30).max(300).optional(),
    votingSeconds: z.number().int().min(20).max(180).optional(),
    resultsSeconds: z.number().int().min(5).max(60).optional(),
    anonymousVoting: z.boolean().optional(),
    voiceEnabled: z.boolean().optional(),
  })
  .partial();

/** Creates the player's profile on first sign-in. Idempotent. */
export const ensureProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { username?: string }) =>
    z.object({ username: z.string().trim().min(3).max(18).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (existing) return existing;

    const base = (data.username ?? `player${Math.floor(Math.random() * 100000)}`)
      .replace(/[^a-zA-Z0-9_]/g, "")
      .slice(0, 18);
    for (let i = 0; i < 6; i++) {
      const username = i === 0 ? base : `${base}${Math.floor(Math.random() * 9999)}`.slice(0, 18);
      const { data: created, error } = await supabaseAdmin
        .from("profiles")
        .insert({ id: context.userId, username })
        .select("*")
        .single();
      if (!error && created) return created;
    }
    throw new Error("Could not create your profile. Try a different username.");
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { username?: string; avatarKey?: string; frameKey?: string }) =>
    z
      .object({
        username: z
          .string()
          .trim()
          .min(3)
          .max(18)
          .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only.")
          .optional(),
        avatarKey: z.string().max(40).optional(),
        frameKey: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cosmetics must be owned (the two defaults are free).
    for (const [key, prefix] of [
      [data.avatarKey, "avatar_"],
      [data.frameKey, "frame_"],
    ] as const) {
      if (!key || key === "ash" || key === "none") continue;
      const { data: owned } = await supabaseAdmin
        .from("user_items")
        .select("item_id")
        .eq("user_id", context.userId)
        .eq("item_id", `${prefix}${key}`)
        .maybeSingle();
      if (!owned) throw new Error("You do not own that item.");
    }

    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .update({
        ...(data.username ? { username: data.username } : {}),
        ...(data.avatarKey ? { avatar_key: data.avatarKey } : {}),
        ...(data.frameKey ? { frame_key: data.frameKey } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message.includes("profiles_username_key") ? "That username is taken." : error.message);
    return updated;
  });

export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { name: string; isPrivate: boolean; maxPlayers: number; settings: unknown }) =>
      z
        .object({
          name: z.string().trim().min(1).max(40),
          isPrivate: z.boolean(),
          maxPlayers: z.number().int().min(4).max(16),
          settings: settingsSchema,
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const room = await (await core()).createRoom({ userId: context.userId, ...data });
    return { id: room.id, code: room.code };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) =>
    z.object({ code: z.string().trim().min(4).max(10) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const room = await (await core()).joinRoom({ userId: context.userId, code: data.code });
    return { id: room.id, code: room.code };
  });

export const quickJoin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rooms } = await supabaseAdmin
      .from("rooms")
      .select("id, code, max_players, room_players(user_id)")
      .eq("is_private", false)
      .eq("status", "lobby")
      .order("created_at", { ascending: false })
      .limit(25);
    const open = (rooms ?? []).find(
      (r) => (r.room_players as { user_id: string }[]).length < r.max_players,
    );
    const mod = await core();
    if (open) return mod.joinRoom({ userId: context.userId, code: open.code });
    return mod.createRoom({
      userId: context.userId,
      name: "Quick table",
      isPrivate: false,
      maxPlayers: 8,
      settings: {},
    });
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string }) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await (await core()).leaveRoom({ userId: context.userId, roomId: data.roomId });
    return { ok: true };
  });

export const setReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string; ready: boolean }) =>
    z.object({ roomId: z.string().uuid(), ready: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await (await core()).setReady({ userId: context.userId, ...data });
    return { ok: true };
  });

export const updateRoomSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      roomId: string;
      name?: string;
      isPrivate?: boolean;
      maxPlayers?: number;
      settings?: unknown;
    }) =>
      z
        .object({
          roomId: z.string().uuid(),
          name: z.string().trim().min(1).max(40).optional(),
          isPrivate: z.boolean().optional(),
          maxPlayers: z.number().int().min(4).max(16).optional(),
          settings: settingsSchema.optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { code } = await (await core()).updateRoomSettings({ userId: context.userId, ...data });
    return { ok: true, code };
  });

export const startGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string }) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) =>
    (await core()).startGame({ userId: context.userId, roomId: data.roomId }),
  );

export const getGameState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { gameId: string }) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const mod = await core();
    await mod.advanceIfDue(data.gameId);
    return mod.readGameState(data.gameId, context.userId);
  });

export const submitNightAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { gameId: string; targetId: string | null }) =>
    z.object({ gameId: z.string().uuid(), targetId: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await (await core()).submitNightAction({ userId: context.userId, ...data });
    return { ok: true };
  });

export const submitVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { gameId: string; targetId: string | null }) =>
    z.object({ gameId: z.string().uuid(), targetId: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await (await core()).submitVote({ userId: context.userId, ...data });
    return { ok: true };
  });

export const sendChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { roomId: string; gameId: string | null; content: string }) =>
    z
      .object({
        roomId: z.string().uuid(),
        gameId: z.string().uuid().nullable(),
        content: z.string().trim().min(1).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await (await core()).sendChat({ userId: context.userId, ...data });
    return { ok: true };
  });

export const reportPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportedId: string; roomId: string | null; reason: string }) =>
    z
      .object({
        reportedId: z.string().uuid(),
        roomId: z.string().uuid().nullable(),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await (await core()).reportPlayer({ userId: context.userId, ...data });
    return { ok: true };
  });

export const purchaseItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { itemId: string }) => z.object({ itemId: z.string().max(60) }).parse(d))
  .handler(async ({ data, context }) =>
    (await core()).purchaseItem({ userId: context.userId, itemId: data.itemId }),
  );

/** Public leaderboard: only non-sensitive ranking columns, top 100 by XP. */
export const getLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, avatar_key, frame_key, xp, level, wins, games_played")
      .order("xp", { ascending: false })
      .limit(100);
    if (error) throw new Error("Could not load the leaderboard.");
    return data ?? [];
  });

/**
 * Submits a finished match's public table chat for an AI summary of key claims
 * and contradictions. The server loads the log itself (clients can't forge it),
 * only participants may ask, and the result is cached per match.
 */
export const analyzeMatchChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { gameId: string }) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { analyzeTranscript, AiGatewayError } = await import("./ai/chat-analysis.server");

    const { data: me } = await supabaseAdmin
      .from("game_players")
      .select("user_id")
      .eq("game_id", data.gameId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!me) throw new Error("Only players from this match can analyse its chat.");

    const { data: game } = await supabaseAdmin
      .from("games")
      .select("id, phase, winner")
      .eq("id", data.gameId)
      .maybeSingle();
    if (!game || game.phase !== "ended") throw new Error("Chat can only be analysed after the match ends.");

    const { data: cached } = await supabaseAdmin
      .from("match_chat_analyses")
      .select("*")
      .eq("game_id", data.gameId)
      .maybeSingle();
    if (cached) return cached;

    const [{ data: messages }, { data: results }] = await Promise.all([
      supabaseAdmin
        .from("chat_messages")
        .select("content, created_at, profiles(username)")
        .eq("game_id", data.gameId)
        .eq("channel", "day")
        .order("created_at", { ascending: true })
        .limit(600),
      supabaseAdmin
        .from("match_results")
        .select("role, survived, profiles(username)")
        .eq("game_id", data.gameId),
    ]);
    const lines = (messages ?? []).map((m) => ({
      round: null,
      player: (m.profiles as { username: string } | null)?.username ?? "unknown",
      content: m.content,
    }));
    if (lines.length < 3) throw new Error("There isn't enough table talk in this match to analyse.");

    let analysis;
    try {
      analysis = await analyzeTranscript({
        lines,
        winner: game.winner,
        roster: (results ?? []).map((r) => ({
          player: (r.profiles as { username: string } | null)?.username ?? "unknown",
          role: r.role,
          survived: r.survived,
        })),
      });
    } catch (err) {
      if (err instanceof AiGatewayError) throw new Error(err.message);
      throw err;
    }

    const { data: saved, error } = await supabaseAdmin
      .from("match_chat_analyses")
      .upsert(
        { game_id: data.gameId, requested_by: context.userId, message_count: lines.length, analysis },
        { onConflict: "game_id", ignoreDuplicates: false },
      )
      .select("*")
      .single();
    if (error) throw new Error("Could not save the analysis.");
    return saved;
  });
