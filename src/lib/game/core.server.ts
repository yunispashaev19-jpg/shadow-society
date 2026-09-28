/**
 * Server-authoritative game runtime.
 *
 * This module is the ONLY place where match state changes. It runs with the
 * service-role client, so every entry point must verify the caller itself.
 * Clients can never decide an outcome — they only submit intents.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import {
  MIN_PLAYERS,
  assignRoles,
  checkWin,
  computeRewards,
  levelForXp,
  nextPhase,
  normalizeSettings,
  phaseDurationSeconds,
  resolveNight,
  tallyVotes,
  type GameSettings,
  type Phase,
  type Role,
} from "./engine";

type Db = Database["public"]["Tables"];
type GameRow = Db["games"]["Row"];

/** Settings patch as it arrives from validated client input. */
export type PartialSettings = { [K in keyof GameSettings]?: GameSettings[K] | undefined };

export class GameError extends Error {}

function fail(message: string): never {
  throw new GameError(message);
}

const sb = () => supabaseAdmin;

function inSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function loadGame(gameId: string): Promise<GameRow> {
  const { data, error } = await sb().from("games").select("*").eq("id", gameId).maybeSingle();
  if (error) fail(error.message);
  if (!data) fail("Match not found.");
  return data;
}

async function loadRoster(gameId: string) {
  const [{ data: players }, { data: roles }] = await Promise.all([
    sb().from("game_players").select("*").eq("game_id", gameId).order("seat"),
    sb().from("game_roles").select("*").eq("game_id", gameId),
  ]);
  const roleBy = new Map((roles ?? []).map((r) => [r.user_id, r.role as Role]));
  return (players ?? []).map((p) => ({
    ...p,
    role: roleBy.get(p.user_id) ?? ("civilian" as Role),
  }));
}

async function logEvent(
  gameId: string,
  round: number,
  phase: Phase,
  kind: string,
  message: string,
  payload: Record<string, unknown> = {},
  audience: string | null = null,
) {
  await sb().from("game_events").insert({
    game_id: gameId,
    round,
    phase,
    kind,
    message,
    payload: payload as never,
    audience,
  });
}

// ------------------------------------------------------------------- rooms

export async function createRoom(input: {
  userId: string;
  name: string;
  isPrivate: boolean;
  maxPlayers: number;
  settings: PartialSettings;
}) {
  await leaveAllRooms(input.userId);
  const maxPlayers = Math.min(16, Math.max(MIN_PLAYERS, Math.round(input.maxPlayers)));
  const settings = normalizeSettings(input.settings, maxPlayers);
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeRoomCode();
    const { data, error } = await sb()
      .from("rooms")
      .insert({
        code,
        name: input.name.slice(0, 40) || "Untitled table",
        host_id: input.userId,
        is_private: input.isPrivate,
        max_players: maxPlayers,
        settings: settings as never,
      })
      .select("*")
      .single();
    if (!error && data) {
      await sb()
        .from("room_players")
        .insert({ room_id: data.id, user_id: input.userId, seat: 1, is_ready: true });
      return data;
    }
    if (error && !error.message.includes("rooms_code_key")) fail(error.message);
  }
  return fail("Could not allocate a room code. Try again.");
}

export async function leaveAllRooms(userId: string) {
  const { data: memberships } = await sb()
    .from("room_players")
    .select("room_id")
    .eq("user_id", userId);
  for (const m of memberships ?? []) await leaveRoom({ userId, roomId: m.room_id });
}

export async function joinRoom(input: { userId: string; code: string }) {
  const code = input.code.trim().toUpperCase();
  const { data: room } = await sb().from("rooms").select("*").eq("code", code).maybeSingle();
  if (!room) fail("No room with that code.");
  if (room.status === "closed") fail("That room is closed.");

  const { data: existing } = await sb()
    .from("room_players")
    .select("*")
    .eq("room_id", room.id)
    .order("seat");
  if (existing?.some((p) => p.user_id === input.userId)) return room;
  if (room.status === "in_game") fail("That match has already started.");
  if ((existing?.length ?? 0) >= room.max_players) fail("That room is full.");

  await leaveAllRooms(input.userId);
  const taken = new Set((existing ?? []).map((p) => p.seat));
  let seat = 1;
  while (taken.has(seat)) seat++;

  const { error } = await sb()
    .from("room_players")
    .insert({ room_id: room.id, user_id: input.userId, seat });
  if (error) fail("Could not join — the room just filled up.");
  return room;
}

export async function leaveRoom(input: { userId: string; roomId: string }) {
  const { data: room } = await sb().from("rooms").select("*").eq("id", input.roomId).maybeSingle();
  if (!room) return;

  await sb()
    .from("room_players")
    .delete()
    .eq("room_id", input.roomId)
    .eq("user_id", input.userId);

  if (room.status === "in_game" && room.current_game_id) {
    await sb()
      .from("game_players")
      .update({ left_game: true, alive: false })
      .eq("game_id", room.current_game_id)
      .eq("user_id", input.userId);
    await advanceIfDue(room.current_game_id, true);
  }

  const { data: remaining } = await sb()
    .from("room_players")
    .select("user_id, seat")
    .eq("room_id", input.roomId)
    .order("seat");

  if (!remaining || remaining.length === 0) {
    await sb().from("rooms").update({ status: "closed" }).eq("id", input.roomId);
    return;
  }
  if (room.host_id === input.userId) {
    await sb().from("rooms").update({ host_id: remaining[0]!.user_id }).eq("id", input.roomId);
  }
}

export async function setReady(input: { userId: string; roomId: string; ready: boolean }) {
  await sb()
    .from("room_players")
    .update({ is_ready: input.ready, last_seen: new Date().toISOString() })
    .eq("room_id", input.roomId)
    .eq("user_id", input.userId);
}

export async function updateRoomSettings(input: {
  userId: string;
  roomId: string;
  name?: string | undefined;
  isPrivate?: boolean | undefined;
  maxPlayers?: number | undefined;
  settings?: PartialSettings | undefined;
}) {
  const { data: room } = await sb().from("rooms").select("*").eq("id", input.roomId).maybeSingle();
  if (!room) fail("Room not found.");
  if (room.host_id !== input.userId) fail("Only the host can change the settings.");
  if (room.status !== "lobby") fail("Settings are locked once a match starts.");

  const maxPlayers = Math.min(16, Math.max(MIN_PLAYERS, input.maxPlayers ?? room.max_players));
  const merged = normalizeSettings(
    { ...(room.settings as object), ...(input.settings ?? {}) },
    maxPlayers,
  );
  await sb()
    .from("rooms")
    .update({
      name: input.name?.slice(0, 40) ?? room.name,
      is_private: input.isPrivate ?? room.is_private,
      max_players: maxPlayers,
      settings: merged as never,
    })
    .eq("id", input.roomId);
}

// ------------------------------------------------------------------- start

export async function startGame(input: { userId: string; roomId: string }) {
  const { data: room } = await sb().from("rooms").select("*").eq("id", input.roomId).maybeSingle();
  if (!room) fail("Room not found.");
  if (room.host_id !== input.userId) fail("Only the host can start the match.");
  if (room.status === "in_game" && room.current_game_id) return { gameId: room.current_game_id };
  if (room.status !== "lobby") fail("This room is not accepting a new match.");

  const { data: members } = await sb()
    .from("room_players")
    .select("*")
    .eq("room_id", room.id)
    .order("seat");
  const roster = members ?? [];
  if (roster.length < MIN_PLAYERS) fail(`A match needs at least ${MIN_PLAYERS} players.`);
  if (roster.some((p) => p.user_id !== room.host_id && !p.is_ready)) {
    fail("Everyone needs to be ready first.");
  }

  const settings = normalizeSettings(room.settings, roster.length);
  const roles = assignRoles(
    roster.map((p) => p.user_id),
    settings,
  );

  const { data: game, error } = await sb()
    .from("games")
    .insert({
      room_id: room.id,
      round: 1,
      phase: "night",
      phase_ends_at: inSeconds(settings.nightSeconds),
      settings: settings as never,
    })
    .select("*")
    .single();
  if (error || !game) fail(error?.message ?? "Could not create the match.");

  await sb()
    .from("game_players")
    .insert(roster.map((p, i) => ({ game_id: game.id, user_id: p.user_id, seat: i + 1 })));
  await sb()
    .from("game_roles")
    .insert(roster.map((p) => ({ game_id: game.id, user_id: p.user_id, role: roles[p.user_id]! })));

  // Claim the room only if it is still idle — blocks double starts.
  const { data: claimed } = await sb()
    .from("rooms")
    .update({ status: "in_game", current_game_id: game.id })
    .eq("id", room.id)
    .eq("status", "lobby")
    .select("id");
  if (!claimed || claimed.length === 0) {
    await sb().from("games").delete().eq("id", game.id);
    const { data: fresh } = await sb().from("rooms").select("current_game_id").eq("id", room.id).single();
    return { gameId: fresh?.current_game_id ?? null };
  }

  await logEvent(game.id, 1, "night", "phase", "Night falls. The town sleeps.");
  return { gameId: game.id };
}

// ------------------------------------------------------------------ actions

export async function submitNightAction(input: {
  userId: string;
  gameId: string;
  targetId: string | null;
}) {
  const game = await loadGame(input.gameId);
  if (game.phase !== "night") fail("Night actions are closed.");
  const roster = await loadRoster(input.gameId);
  const me = roster.find((p) => p.user_id === input.userId);
  if (!me) fail("You are not in this match.");
  if (!me.alive) fail("Eliminated players cannot act.");

  const kind = me.role === "mafia" ? "kill" : me.role === "doctor" ? "heal" : me.role === "detective" ? "investigate" : null;
  if (!kind) fail("Your role has no night action.");

  if (input.targetId) {
    const target = roster.find((p) => p.user_id === input.targetId);
    if (!target || !target.alive) fail("That target is not available.");
    if (kind !== "heal" && target.user_id === input.userId) fail("You cannot target yourself.");
    if (kind === "kill" && target.role === "mafia") fail("You cannot target your own family.");
  }

  await sb()
    .from("game_actions")
    .upsert(
      {
        game_id: input.gameId,
        round: game.round,
        phase: "night",
        actor_id: input.userId,
        target_id: input.targetId,
        kind,
      },
      { onConflict: "game_id,round,phase,actor_id,kind" },
    );
  await advanceIfDue(input.gameId);
}

export async function submitVote(input: {
  userId: string;
  gameId: string;
  targetId: string | null;
}) {
  const game = await loadGame(input.gameId);
  if (game.phase !== "voting") fail("Voting is closed.");
  const roster = await loadRoster(input.gameId);
  const me = roster.find((p) => p.user_id === input.userId);
  if (!me?.alive) fail("Only living players may vote.");
  if (input.targetId && !roster.find((p) => p.user_id === input.targetId && p.alive)) {
    fail("That target is not available.");
  }

  await sb()
    .from("game_actions")
    .upsert(
      {
        game_id: input.gameId,
        round: game.round,
        phase: "voting",
        actor_id: input.userId,
        target_id: input.targetId,
        kind: "vote",
      },
      { onConflict: "game_id,round,phase,actor_id,kind" },
    );
  await advanceIfDue(input.gameId);
}

// ---------------------------------------------------------------- phase loop

/**
 * Advances the match when the timer expired, when every required actor has
 * already submitted, or when the roster collapsed. Safe to call from any
 * client at any frequency: the version guard makes it a no-op for losers of
 * the race.
 */
export async function advanceIfDue(gameId: string, force = false): Promise<void> {
  const game = await loadGame(gameId);
  if (game.phase === "ended") return;

  const settings = normalizeSettings(game.settings, 16);
  const roster = await loadRoster(gameId);
  const alive = roster.filter((p) => p.alive && !p.left_game);
  const expired = new Date(game.phase_ends_at).getTime() <= Date.now();

  let ready = expired || force;
  if (!ready && game.phase === "night") {
    const { data: acts } = await sb()
      .from("game_actions")
      .select("actor_id")
      .eq("game_id", gameId)
      .eq("round", game.round)
      .eq("phase", "night");
    const actors = new Set((acts ?? []).map((a) => a.actor_id));
    const required = alive.filter((p) => p.role !== "civilian").map((p) => p.user_id);
    ready = required.length > 0 && required.every((id) => actors.has(id));
  }
  if (!ready && game.phase === "voting") {
    const { data: acts } = await sb()
      .from("game_actions")
      .select("actor_id")
      .eq("game_id", gameId)
      .eq("round", game.round)
      .eq("phase", "voting");
    ready = (acts?.length ?? 0) >= alive.length && alive.length > 0;
  }
  if (!ready) return;

  // Optimistic lock — only one caller wins the transition.
  const { data: locked } = await sb()
    .from("games")
    .update({ version: game.version + 1 })
    .eq("id", gameId)
    .eq("version", game.version)
    .select("id");
  if (!locked || locked.length === 0) return;

  if (alive.length === 0) {
    await endGame(gameId, "mafia", game.round);
    return;
  }

  if (game.phase === "night") {
    const { data: acts } = await sb()
      .from("game_actions")
      .select("*")
      .eq("game_id", gameId)
      .eq("round", game.round)
      .eq("phase", "night");
    const outcome = resolveNight(
      (acts ?? []).map((a) => ({
        actorId: a.actor_id,
        targetId: a.target_id,
        kind: a.kind as "kill" | "heal" | "investigate",
      })),
      roster.map((p) => ({ id: p.user_id, role: p.role, alive: p.alive && !p.left_game })),
    );

    for (const inv of outcome.investigations) {
      const name = await displayName(inv.targetId);
      await logEvent(
        gameId,
        game.round,
        "night",
        "investigation",
        inv.isMafia
          ? `Your investigation confirms ${name} is Mafia.`
          : `Your investigation clears ${name}. They are not Mafia.`,
        { targetId: inv.targetId, isMafia: inv.isMafia },
        inv.actorId,
      );
    }

    if (outcome.killedId) {
      await sb()
        .from("game_players")
        .update({ alive: false, eliminated_round: game.round })
        .eq("game_id", gameId)
        .eq("user_id", outcome.killedId);
      const name = await displayName(outcome.killedId);
      await logEvent(gameId, game.round, "day", "death", `${name} did not survive the night.`, {
        userId: outcome.killedId,
      });
    } else {
      await logEvent(
        gameId,
        game.round,
        "day",
        "death",
        outcome.savedId
          ? "A body was expected. The doctor got there first."
          : "The night passed without a death.",
      );
    }

    const after = await loadRoster(gameId);
    const winner = checkWin(after.map((p) => ({ alive: p.alive, role: p.role, leftGame: p.left_game })));
    if (winner) return endGame(gameId, winner, game.round);

    await setPhase(gameId, "day", game.round, settings);
    return;
  }

  if (game.phase === "day") {
    await setPhase(gameId, "voting", game.round, settings);
    await logEvent(gameId, game.round, "voting", "phase", "The town casts its votes.");
    return;
  }

  if (game.phase === "voting") {
    const { data: acts } = await sb()
      .from("game_actions")
      .select("*")
      .eq("game_id", gameId)
      .eq("round", game.round)
      .eq("phase", "voting");
    const tally = tallyVotes(
      (acts ?? []).map((a) => ({ actorId: a.actor_id, targetId: a.target_id })),
      alive.map((p) => p.user_id),
    );

    if (tally.eliminatedId) {
      const victim = roster.find((p) => p.user_id === tally.eliminatedId)!;
      await sb()
        .from("game_players")
        .update({ alive: false, eliminated_round: game.round })
        .eq("game_id", gameId)
        .eq("user_id", tally.eliminatedId);
      const name = await displayName(tally.eliminatedId);
      await logEvent(
        gameId,
        game.round,
        "results",
        "lynch",
        `${name} was voted out. They were ${labelRole(victim.role)}.`,
        { userId: tally.eliminatedId, role: victim.role, counts: tally.counts },
      );
    } else {
      await logEvent(
        gameId,
        game.round,
        "results",
        "lynch",
        tally.tie ? "The vote was tied. Nobody is eliminated." : "No majority. Nobody is eliminated.",
        { counts: tally.counts },
      );
    }

    const after = await loadRoster(gameId);
    const winner = checkWin(after.map((p) => ({ alive: p.alive, role: p.role, leftGame: p.left_game })));
    if (winner) return endGame(gameId, winner, game.round);

    await setPhase(gameId, "results", game.round, settings);
    return;
  }

  if (game.phase === "results") {
    const round = game.round + 1;
    await setPhase(gameId, "night", round, settings);
    await logEvent(gameId, round, "night", "phase", "Night falls again.");
  }
}

async function setPhase(gameId: string, phase: Phase, round: number, settings: GameSettings) {
  await sb()
    .from("games")
    .update({
      phase: phase as Db["games"]["Row"]["phase"],
      round,
      phase_ends_at: inSeconds(phaseDurationSeconds(phase, settings)),
    })
    .eq("id", gameId);
}

function labelRole(role: Role): string {
  return { mafia: "Mafia", civilian: "a Civilian", detective: "the Detective", doctor: "the Doctor" }[
    role
  ];
}

async function displayName(userId: string): Promise<string> {
  const { data } = await sb().from("profiles").select("username").eq("id", userId).maybeSingle();
  return data?.username ?? "A player";
}

// ---------------------------------------------------------------- finishing

async function endGame(gameId: string, winner: "mafia" | "town", round: number) {
  const { data: game } = await sb().from("games").select("*").eq("id", gameId).maybeSingle();
  if (!game || game.phase === "ended") return;

  await sb()
    .from("games")
    .update({ phase: "ended", winner, ended_at: new Date().toISOString() })
    .eq("id", gameId);
  await logEvent(
    gameId,
    round,
    "ended",
    "end",
    winner === "mafia" ? "The Mafia takes the town." : "The town is clean. Civilians win.",
    { winner },
  );

  const roster = await loadRoster(gameId);
  for (const player of roster) {
    const team = player.role === "mafia" ? "mafia" : "town";
    const won = team === winner;
    const rewards = computeRewards({
      won,
      survived: player.alive,
      role: player.role,
      rounds: round,
    });
    await sb().from("match_results").upsert(
      {
        game_id: gameId,
        user_id: player.user_id,
        role: player.role,
        won,
        survived: player.alive,
        xp_earned: rewards.xp,
        coins_earned: rewards.coins,
      },
      { onConflict: "game_id,user_id" },
    );

    const { data: profile } = await sb()
      .from("profiles")
      .select("*")
      .eq("id", player.user_id)
      .maybeSingle();
    if (!profile) continue;
    const xp = profile.xp + rewards.xp;
    const roleColumn = `${player.role}_games` as const;
    await sb()
      .from("profiles")
      .update({
        xp,
        level: levelForXp(xp),
        coins: profile.coins + rewards.coins,
        games_played: profile.games_played + 1,
        wins: profile.wins + (won ? 1 : 0),
        [roleColumn]: (profile[roleColumn] ?? 0) + 1,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", player.user_id);
    await sb().from("transactions").insert({
      user_id: player.user_id,
      kind: "match_reward",
      amount: rewards.coins,
      reference: gameId,
    });
    await grantAchievements(player.user_id);
  }

  await sb()
    .from("rooms")
    .update({ status: "lobby", current_game_id: null })
    .eq("id", game.room_id);
  await sb().from("room_players").update({ is_ready: false }).eq("room_id", game.room_id);
}

async function grantAchievements(userId: string) {
  const { data: profile } = await sb().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile) return;
  const { data: results } = await sb()
    .from("match_results")
    .select("role, won")
    .eq("user_id", userId);
  const winsAs = (role: Role) =>
    (results ?? []).filter((r) => r.role === role && r.won).length;

  const unlocked: string[] = [];
  if (profile.games_played >= 1) unlocked.push("first_blood");
  if (profile.wins >= 1) unlocked.push("first_win");
  if (winsAs("mafia") >= 5) unlocked.push("mafia_master");
  if (winsAs("detective") >= 5) unlocked.push("sharp_eye");
  if (winsAs("doctor") >= 5) unlocked.push("lifesaver");
  if (profile.games_played >= 25) unlocked.push("veteran");
  if (unlocked.length === 0) return;

  await sb()
    .from("user_achievements")
    .upsert(
      unlocked.map((id) => ({ user_id: userId, achievement_id: id })),
      { onConflict: "user_id,achievement_id" },
    );
}

// ------------------------------------------------------------------- reading

export async function readGameState(gameId: string, userId: string) {
  const game = await loadGame(gameId);
  const roster = await loadRoster(gameId);
  const me = roster.find((p) => p.user_id === userId);
  if (!me) fail("You are not in this match.");

  const ids = roster.map((p) => p.user_id);
  const { data: profiles } = await sb()
    .from("profiles")
    .select("id, username, avatar_key, frame_key, level")
    .in("id", ids);
  const profileBy = new Map((profiles ?? []).map((p) => [p.id, p]));
  const settings = normalizeSettings(game.settings, roster.length);
  const ended = game.phase === "ended";

  const { data: myActions } = await sb()
    .from("game_actions")
    .select("*")
    .eq("game_id", gameId)
    .eq("round", game.round)
    .eq("actor_id", userId);

  // Vote counts are public during voting unless the host made it anonymous.
  let voteCounts: Record<string, number> = {};
  let votedCount = 0;
  if (game.phase === "voting") {
    const { data: votes } = await sb()
      .from("game_actions")
      .select("target_id")
      .eq("game_id", gameId)
      .eq("round", game.round)
      .eq("phase", "voting");
    votedCount = votes?.length ?? 0;
    if (!settings.anonymousVoting) {
      for (const v of votes ?? []) {
        if (v.target_id) voteCounts[v.target_id] = (voteCounts[v.target_id] ?? 0) + 1;
      }
    }
  }

  // Mafia recognise each other; everyone sees all roles once the match ends.
  const seesRoleOf = (other: (typeof roster)[number]) =>
    ended || other.user_id === userId || (me.role === "mafia" && other.role === "mafia");

  return {
    game: {
      id: game.id,
      roomId: game.room_id,
      round: game.round,
      phase: game.phase as Phase,
      phaseEndsAt: game.phase_ends_at,
      winner: game.winner as "mafia" | "town" | null,
      settings,
    },
    me: {
      userId,
      role: me.role,
      alive: me.alive && !me.left_game,
      actedThisRound: (myActions ?? []).some((a) => a.phase === game.phase),
      myTarget: (myActions ?? []).find((a) => a.phase === game.phase)?.target_id ?? null,
    },
    players: roster.map((p) => ({
      userId: p.user_id,
      seat: p.seat,
      alive: p.alive && !p.left_game,
      left: p.left_game,
      username: profileBy.get(p.user_id)?.username ?? "Player",
      avatarKey: profileBy.get(p.user_id)?.avatar_key ?? "ash",
      frameKey: profileBy.get(p.user_id)?.frame_key ?? "none",
      level: profileBy.get(p.user_id)?.level ?? 1,
      role: seesRoleOf(p) ? p.role : null,
      votes: voteCounts[p.user_id] ?? 0,
    })),
    votedCount,
    aliveCount: roster.filter((p) => p.alive && !p.left_game).length,
  };
}

export type GameState = Awaited<ReturnType<typeof readGameState>>;

// ---------------------------------------------------------------------- chat

const RATE_WINDOW_MS = 10_000;
const RATE_LIMIT = 6;

export async function sendChat(input: {
  userId: string;
  roomId: string;
  gameId: string | null;
  content: string;
}) {
  const content = input.content.trim().slice(0, 300);
  if (!content) fail("Message is empty.");

  const { data: membership } = await sb()
    .from("room_players")
    .select("user_id")
    .eq("room_id", input.roomId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!membership) fail("You are not in this room.");

  const { data: recent } = await sb()
    .from("chat_messages")
    .select("id")
    .eq("user_id", input.userId)
    .gte("created_at", new Date(Date.now() - RATE_WINDOW_MS).toISOString());
  if ((recent?.length ?? 0) >= RATE_LIMIT) fail("Slow down a little.");

  let channel: Database["public"]["Enums"]["chat_channel"] = "lobby";
  if (input.gameId) {
    const game = await loadGame(input.gameId);
    const roster = await loadRoster(input.gameId);
    const me = roster.find((p) => p.user_id === input.userId);
    if (!me) fail("You are not in this match.");
    if (!me.alive || me.left_game) channel = "dead";
    else if (game.phase === "night") {
      if (me.role !== "mafia") fail("The town is asleep. You cannot speak at night.");
      channel = "mafia";
    } else if (game.phase === "ended") channel = "lobby";
    else channel = "day";
  }

  const { error } = await sb().from("chat_messages").insert({
    room_id: input.roomId,
    game_id: input.gameId,
    user_id: input.userId,
    channel,
    content,
  });
  if (error) fail(error.message);
}

export async function reportPlayer(input: {
  userId: string;
  reportedId: string;
  roomId: string | null;
  reason: string;
}) {
  if (input.userId === input.reportedId) fail("You cannot report yourself.");
  await sb().from("reports").insert({
    reporter_id: input.userId,
    reported_id: input.reportedId,
    room_id: input.roomId,
    reason: input.reason.slice(0, 500),
  });
}

// ------------------------------------------------------------------ economy

export async function purchaseItem(input: { userId: string; itemId: string }) {
  const { data: item } = await sb()
    .from("shop_items")
    .select("*")
    .eq("id", input.itemId)
    .maybeSingle();
  if (!item) fail("That item does not exist.");

  const { data: owned } = await sb()
    .from("user_items")
    .select("item_id")
    .eq("user_id", input.userId)
    .eq("item_id", input.itemId)
    .maybeSingle();
  if (owned) fail("You already own this.");

  const { data: profile } = await sb()
    .from("profiles")
    .select("coins")
    .eq("id", input.userId)
    .maybeSingle();
  if (!profile) fail("Profile not found.");
  if (profile.coins < item.price) fail("Not enough coins.");

  // Conditional update: the balance must still be what we read.
  const { data: charged } = await sb()
    .from("profiles")
    .update({ coins: profile.coins - item.price })
    .eq("id", input.userId)
    .eq("coins", profile.coins)
    .select("coins");
  if (!charged || charged.length === 0) fail("Balance changed — try again.");

  await sb().from("user_items").insert({ user_id: input.userId, item_id: item.id });
  await sb()
    .from("transactions")
    .insert({ user_id: input.userId, kind: "purchase", amount: -item.price, reference: item.id });
  return { coins: charged[0]!.coins };
}
