/**
 * Pure, side-effect-free Mafia game engine.
 *
 * Nothing here touches the network or the database. Every function is
 * deterministic given its inputs (randomness is injected), so the rules can be
 * unit-tested in isolation and re-used by the server-authoritative layer in
 * `src/lib/game.functions.ts`.
 */

export type Role = "mafia" | "civilian" | "detective" | "doctor";
export type Phase = "lobby" | "night" | "day" | "voting" | "results" | "ended";
export type Winner = "mafia" | "town";

export interface GameSettings {
  mafiaCount: number;
  detective: boolean;
  doctor: boolean;
  nightSeconds: number;
  discussionSeconds: number;
  votingSeconds: number;
  resultsSeconds: number;
  anonymousVoting: boolean;
  voiceEnabled: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  mafiaCount: 2,
  detective: true,
  doctor: true,
  nightSeconds: 35,
  discussionSeconds: 90,
  votingSeconds: 45,
  resultsSeconds: 12,
  anonymousVoting: false,
  voiceEnabled: false,
};

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 16;

export const ROLE_META: Record<
  Role,
  { team: "mafia" | "town"; actsAtNight: boolean; tokenClass: string }
> = {
  mafia: { team: "mafia", actsAtNight: true, tokenClass: "text-mafia" },
  civilian: { team: "town", actsAtNight: false, tokenClass: "text-civilian" },
  detective: { team: "town", actsAtNight: true, tokenClass: "text-detective" },
  doctor: { team: "town", actsAtNight: true, tokenClass: "text-doctor" },
};

export function maxMafiaFor(playerCount: number): number {
  return Math.max(1, Math.floor((playerCount - 1) / 2));
}

export function normalizeSettings(raw: unknown, playerCount: number): GameSettings {
  const input = (raw ?? {}) as Partial<GameSettings>;
  const clamp = (v: unknown, min: number, max: number, fallback: number) => {
    const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
    return Math.min(max, Math.max(min, n));
  };
  return {
    mafiaCount: clamp(input.mafiaCount, 1, maxMafiaFor(playerCount), DEFAULT_SETTINGS.mafiaCount),
    detective: input.detective ?? DEFAULT_SETTINGS.detective,
    doctor: input.doctor ?? DEFAULT_SETTINGS.doctor,
    nightSeconds: clamp(input.nightSeconds, 15, 120, DEFAULT_SETTINGS.nightSeconds),
    discussionSeconds: clamp(input.discussionSeconds, 30, 300, DEFAULT_SETTINGS.discussionSeconds),
    votingSeconds: clamp(input.votingSeconds, 20, 180, DEFAULT_SETTINGS.votingSeconds),
    resultsSeconds: clamp(input.resultsSeconds, 5, 60, DEFAULT_SETTINGS.resultsSeconds),
    anonymousVoting: input.anonymousVoting ?? false,
    voiceEnabled: input.voiceEnabled ?? false,
  };
}

/** Builds the exact role deck for a game. Length always equals playerCount. */
export function buildRoleDeck(playerCount: number, settings: GameSettings): Role[] {
  if (playerCount < MIN_PLAYERS) {
    throw new Error(`A match needs at least ${MIN_PLAYERS} players.`);
  }
  const mafia = Math.min(Math.max(1, settings.mafiaCount), maxMafiaFor(playerCount));
  const deck: Role[] = Array.from({ length: mafia }, () => "mafia" as Role);
  if (settings.detective && deck.length < playerCount) deck.push("detective");
  if (settings.doctor && deck.length < playerCount) deck.push("doctor");
  while (deck.length < playerCount) deck.push("civilian");
  return deck;
}

/** Fisher-Yates with an injected RNG so shuffles are reproducible in tests. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

export function assignRoles(
  userIds: readonly string[],
  settings: GameSettings,
  rng: () => number = Math.random,
): Record<string, Role> {
  const deck = shuffle(buildRoleDeck(userIds.length, settings), rng);
  const result: Record<string, Role> = {};
  userIds.forEach((id, i) => {
    result[id] = deck[i]!;
  });
  return result;
}

export interface NightAction {
  actorId: string;
  targetId: string | null;
  kind: "kill" | "heal" | "investigate";
}

export interface NightOutcome {
  killedId: string | null;
  savedId: string | null;
  investigations: { actorId: string; targetId: string; isMafia: boolean }[];
}

/**
 * Resolves one night. Mafia votes are tallied (majority, ties broken by the
 * injected RNG), the doctor's heal can cancel the kill, and the detective
 * learns only whether the target is mafia.
 */
export function resolveNight(
  actions: readonly NightAction[],
  players: readonly { id: string; role: Role; alive: boolean }[],
  rng: () => number = Math.random,
): NightOutcome {
  const aliveIds = new Set(players.filter((p) => p.alive).map((p) => p.id));
  const roleOf = new Map(players.map((p) => [p.id, p.role]));
  const valid = actions.filter(
    (a) => a.targetId && aliveIds.has(a.actorId) && aliveIds.has(a.targetId),
  );

  const killVotes = new Map<string, number>();
  for (const a of valid) {
    if (a.kind !== "kill" || roleOf.get(a.actorId) !== "mafia") continue;
    killVotes.set(a.targetId!, (killVotes.get(a.targetId!) ?? 0) + 1);
  }
  let killedId: string | null = null;
  if (killVotes.size > 0) {
    const top = Math.max(...killVotes.values());
    const leaders = [...killVotes.entries()].filter(([, n]) => n === top).map(([id]) => id);
    killedId = leaders[Math.floor(rng() * leaders.length)] ?? null;
  }

  const savedId =
    valid.find((a) => a.kind === "heal" && roleOf.get(a.actorId) === "doctor")?.targetId ?? null;

  const investigations = valid
    .filter((a) => a.kind === "investigate" && roleOf.get(a.actorId) === "detective")
    .map((a) => ({
      actorId: a.actorId,
      targetId: a.targetId!,
      isMafia: roleOf.get(a.targetId!) === "mafia",
    }));

  return {
    killedId: killedId && killedId === savedId ? null : killedId,
    savedId,
    investigations,
  };
}

export interface VoteTally {
  counts: Record<string, number>;
  eliminatedId: string | null;
  tie: boolean;
}

/** Plurality vote. A tie means nobody is eliminated. Skips count as abstentions. */
export function tallyVotes(
  votes: readonly { actorId: string; targetId: string | null }[],
  aliveIds: readonly string[],
): VoteTally {
  const alive = new Set(aliveIds);
  const counts: Record<string, number> = {};
  const seen = new Set<string>();
  for (const v of votes) {
    if (!alive.has(v.actorId) || seen.has(v.actorId)) continue;
    seen.add(v.actorId);
    if (!v.targetId || !alive.has(v.targetId)) continue;
    counts[v.targetId] = (counts[v.targetId] ?? 0) + 1;
  }
  const entries = Object.entries(counts);
  if (entries.length === 0) return { counts, eliminatedId: null, tie: false };
  const top = Math.max(...entries.map(([, n]) => n));
  const leaders = entries.filter(([, n]) => n === top);
  if (leaders.length > 1) return { counts, eliminatedId: null, tie: true };
  return { counts, eliminatedId: leaders[0]![0], tie: false };
}

/** Town wins when no mafia remain; mafia win when they reach parity. */
export function checkWin(
  players: readonly { alive: boolean; role: Role; leftGame?: boolean }[],
): Winner | null {
  const alive = players.filter((p) => p.alive && !p.leftGame);
  const mafia = alive.filter((p) => ROLE_META[p.role].team === "mafia").length;
  const town = alive.length - mafia;
  if (mafia === 0) return "town";
  if (mafia >= town) return "mafia";
  return null;
}

export function phaseDurationSeconds(phase: Phase, settings: GameSettings): number {
  switch (phase) {
    case "night":
      return settings.nightSeconds;
    case "day":
      return settings.discussionSeconds;
    case "voting":
      return settings.votingSeconds;
    case "results":
      return settings.resultsSeconds;
    default:
      return 30;
  }
}

export function nextPhase(phase: Phase): Phase {
  switch (phase) {
    case "night":
      return "day";
    case "day":
      return "voting";
    case "voting":
      return "results";
    case "results":
      return "night";
    default:
      return "ended";
  }
}

// ---------------------------------------------------------------- progression

/** Level curve: level N requires 100 * N * (N-1) / 2 cumulative XP. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1) && level < 200) level++;
  return level;
}

export function xpForLevel(level: number): number {
  return (100 * level * (level - 1)) / 2;
}

export function levelProgress(xp: number): { level: number; into: number; needed: number } {
  const level = levelForXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, into: xp - base, needed: next - base };
}

export function computeRewards(input: {
  won: boolean;
  survived: boolean;
  role: Role;
  rounds: number;
}): { xp: number; coins: number } {
  let xp = 20 + Math.min(input.rounds, 10) * 4;
  if (input.won) xp += 45;
  if (input.survived) xp += 15;
  if (input.role !== "civilian") xp += 10;
  const coins = Math.round(xp * (input.won ? 1.2 : 0.6));
  return { xp, coins };
}
