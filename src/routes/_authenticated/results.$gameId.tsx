import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ChatAnalysisPanel } from "@/components/chat-analysis-panel";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { ROLE_META, type Role } from "@/lib/game/engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/results/$gameId")({
  head: () => ({
    meta: [
      { title: "Match results — Mafia" },
      { name: "description", content: "Who won, who lied, and what everyone earned." },
      { property: "og:title", content: "Match results — Mafia" },
      { property: "og:description", content: "Who won, who lied, and what everyone earned." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Results,
});

function Results() {
  const { gameId } = Route.useParams();
  const { t } = useI18n();
  const { userId, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const summary = useQuery({
    queryKey: ["results", gameId],
    queryFn: async () => {
      const [{ data: game }, { data: results }] = await Promise.all([
        supabase.from("games").select("id, winner, round, room_id, rooms(code)").eq("id", gameId).maybeSingle(),
        supabase
          .from("match_results")
          .select("user_id, role, won, xp_earned, coins_earned, survived, profiles(username, avatar_key, frame_key)")
          .eq("game_id", gameId),
      ]);
      refreshProfile();
      return { game, results: results ?? [] };
    },
  });

  const game = summary.data?.game;
  const results = summary.data?.results ?? [];
  const mine = results.find((r) => r.user_id === userId);
  const winner = game?.winner as "mafia" | "town" | null | undefined;

  return (
    <AppShell>
      <section
        className={cn(
          "panel p-8 text-center",
          winner === "mafia" ? "ring-1 ring-mafia/40" : "ring-1 ring-success/30",
        )}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t("results.summary")}</p>
        <h1 className={cn("mt-3 font-display text-5xl", winner === "mafia" ? "text-mafia" : "text-success")}>
          {winner === "mafia" ? t("results.mafiaWin") : t("results.townWin")}
        </h1>
        {mine && (
          <p className="mt-3 text-sm text-muted-foreground">
            You played as <span className="capitalize text-foreground">{mine.role}</span> and{" "}
            {mine.won ? "won" : "lost"}.
          </p>
        )}

        {mine && (
          <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-surface p-4">
              <Sparkles className="mx-auto size-4 text-accent" aria-hidden />
              <div className="mt-2 font-display text-2xl">+{mine.xp_earned}</div>
              <div className="text-xs text-muted-foreground">{t("results.xp")}</div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <Coins className="mx-auto size-4 text-warning" aria-hidden />
              <div className="mt-2 font-display text-2xl">+{mine.coins_earned}</div>
              <div className="text-xs text-muted-foreground">{t("results.coins")}</div>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {game?.rooms && (
            <Button
              className="accent-surface text-primary-foreground"
              onClick={() =>
                navigate({ to: "/room/$code", params: { code: (game.rooms as { code: string }).code } })
              }
            >
              {t("results.again")}
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate({ to: "/dashboard" })}>
            {t("nav.play")}
          </Button>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {results.map((r) => {
          const profile = r.profiles as { username: string; avatar_key: string; frame_key: string } | null;
          return (
            <div key={r.user_id} className="panel flex items-center gap-3 p-4">
              <PlayerAvatar
                name={profile?.username ?? "?"}
                avatarKey={profile?.avatar_key}
                frameKey={profile?.frame_key}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{profile?.username}</div>
                <div className={cn("text-xs capitalize", ROLE_META[r.role as Role].tokenClass)}>
                  {r.role}
                  {r.survived ? " · survived" : ""}
                </div>
              </div>
              <span className="text-sm text-muted-foreground">+{r.xp_earned} XP</span>
            </div>
          );
        })}
      </section>

      <ChatAnalysisPanel gameId={gameId} />
    </AppShell>
  );
}
