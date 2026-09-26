import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, HeartPulse, Moon, Skull, Sun, Users, Vote } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ChatPanel } from "@/components/chat-panel";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getGameState, submitNightAction, submitVote } from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { ROLE_META, type Role } from "@/lib/game/engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/game/$gameId")({
  head: () => ({
    meta: [
      { title: "Live match — Mafia" },
      { name: "description", content: "An active Mafia match: night actions, discussion and voting." },
      { property: "og:title", content: "Live match — Mafia" },
      { property: "og:description", content: "An active Mafia match: night actions, discussion and voting." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GamePage,
});

const ROLE_ICON: Record<Role, typeof Moon> = {
  mafia: Skull,
  detective: Eye,
  doctor: HeartPulse,
  civilian: Users,
};

const ROLE_BRIEF: Record<Role, string> = {
  mafia: "Choose a victim each night. By day, blend in.",
  detective: "Investigate one player each night to learn if they are Mafia.",
  doctor: "Protect one player each night. You may protect yourself.",
  civilian: "You have no night action. Listen, reason and vote.",
};

function GamePage() {
  const { gameId } = Route.useParams();
  const { t } = useI18n();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getGameState);
  const doNight = useServerFn(submitNightAction);
  const doVote = useServerFn(submitVote);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const state = useQuery({
    queryKey: ["game", gameId],
    // The poll doubles as the phase driver: the server advances the match when
    // the timer has expired, guarded by an optimistic lock.
    refetchInterval: 2000,
    queryFn: () => fetchState({ data: { gameId } }),
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`game-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () =>
        queryClient.invalidateQueries({ queryKey: ["game", gameId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
        () => queryClient.invalidateQueries({ queryKey: ["game", gameId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, queryClient]);

  const events = useQuery({
    queryKey: ["game-events", gameId],
    refetchInterval: 3000,
    queryFn: async () => {
      const { data } = await supabase
        .from("game_events")
        .select("id, round, phase, kind, message, created_at")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false })
        .limit(40);
      return data ?? [];
    },
  });

  const s = state.data;

  useEffect(() => {
    if (s?.game.phase === "ended") {
      navigate({ to: "/results/$gameId", params: { gameId }, replace: true });
    }
  }, [s?.game.phase, gameId, navigate]);

  if (state.isLoading || !s) {
    return (
      <AppShell wide>
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </AppShell>
    );
  }

  const phase = s.game.phase;
  const secondsLeft = Math.max(0, Math.ceil((new Date(s.game.phaseEndsAt).getTime() - now) / 1000));
  const total =
    phase === "night"
      ? s.game.settings.nightSeconds
      : phase === "day"
        ? s.game.settings.discussionSeconds
        : phase === "voting"
          ? s.game.settings.votingSeconds
          : s.game.settings.resultsSeconds;
  const pct = Math.max(0, Math.min(100, (secondsLeft / Math.max(1, total)) * 100));

  const myRole = s.me.role as Role;
  const RoleIcon = ROLE_ICON[myRole];
  const canActAtNight = phase === "night" && s.me.alive && ROLE_META[myRole].actsAtNight;
  const canVote = phase === "voting" && s.me.alive;
  const selectable = canActAtNight || canVote;

  async function pick(targetId: string | null) {
    setBusy(true);
    try {
      if (canActAtNight) await doNight({ data: { gameId, targetId } });
      else if (canVote) await doVote({ data: { gameId, targetId } });
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const phaseLabel =
    phase === "night" ? t("game.night") : phase === "day" ? t("game.day") : phase === "voting" ? t("game.voting") : t("game.results");
  const PhaseIcon = phase === "night" ? Moon : phase === "voting" ? Vote : Sun;

  return (
    <AppShell wide>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section
            className={cn(
              "panel relative overflow-hidden p-6",
              phase === "night" && "ring-1 ring-night/40",
              phase === "voting" && "ring-1 ring-accent/40",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-11 place-items-center rounded-xl border border-border",
                    phase === "night" ? "bg-night/15 text-night" : "bg-day/10 text-day",
                  )}
                >
                  <PhaseIcon className="size-5" aria-hidden />
                </span>
                <div>
                  <h1 className="font-display text-3xl leading-none">{phaseLabel}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("game.round", { n: s.game.round })} · {s.aliveCount} {t("game.alive")}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-4xl tabular-nums">{secondsLeft}s</div>
                {phase === "voting" && (
                  <p className="text-xs text-muted-foreground">
                    {s.votedCount}/{s.aliveCount} voted
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="accent-surface h-full rounded-full transition-[width] duration-200 ease-linear"
                style={{ width: `${pct}%` }}
              />
            </div>
          </section>

          <section className="panel flex items-start gap-4 p-5">
            <span
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-xl border border-border bg-surface",
                ROLE_META[myRole].tokenClass,
              )}
            >
              <RoleIcon className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {t("game.yourRole")}
              </p>
              <h2 className={cn("font-display text-2xl capitalize", ROLE_META[myRole].tokenClass)}>
                {myRole}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{ROLE_BRIEF[myRole]}</p>
              {!s.me.alive && (
                <p className="mt-2 text-sm text-destructive">{t("game.spectating")}</p>
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-2xl">The table</h2>
              {canVote && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => pick(null)}>
                  {t("game.skip")}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {s.players.map((p) => {
                const isTarget = s.me.myTarget === p.userId;
                const clickable =
                  selectable &&
                  p.alive &&
                  !(canActAtNight && myRole !== "doctor" && p.userId === userId) &&
                  !(canActAtNight && myRole === "mafia" && p.role === "mafia");
                return (
                  <button
                    key={p.userId}
                    type="button"
                    disabled={!clickable || busy}
                    onClick={() => pick(p.userId)}
                    className={cn(
                      "panel flex flex-col items-center gap-2 p-4 text-center transition-all",
                      clickable && "hover:-translate-y-0.5 hover:ring-1 hover:ring-primary/60",
                      !clickable && "cursor-default",
                      isTarget && "ring-2 ring-accent",
                      !p.alive && "opacity-55",
                    )}
                  >
                    <PlayerAvatar
                      name={p.username}
                      avatarKey={p.avatarKey}
                      frameKey={p.frameKey}
                      size="lg"
                      dimmed={!p.alive}
                    />
                    <span className="w-full truncate text-sm font-semibold">{p.username}</span>
                    {p.role ? (
                      <span className={cn("text-xs capitalize", ROLE_META[p.role as Role].tokenClass)}>
                        {p.role}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {p.alive ? t("game.alive") : t("game.dead")}
                      </span>
                    )}
                    {phase === "voting" && !s.game.settings.anonymousVoting && p.votes > 0 && (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-semibold text-accent">
                        {p.votes} {t("game.vote").toLowerCase()}
                        {p.votes > 1 ? "s" : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {selectable && s.me.actedThisRound && (
              <p className="mt-3 text-sm text-muted-foreground">{t("game.waitOthers")}</p>
            )}
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold">{t("game.log")}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(events.data ?? []).map((e) => (
                <li key={e.id} className="flex gap-3 text-muted-foreground">
                  <span className="shrink-0 font-mono text-xs text-foreground/60">R{e.round}</span>
                  <span>{e.message}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <ChatPanel
          roomId={s.game.roomId}
          gameId={gameId}
          disabled={phase === "night" && myRole !== "mafia" && s.me.alive}
          disabledHint="The town is asleep"
          className="h-[60vh] lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]"
        />
      </div>
    </AppShell>
  );
}
