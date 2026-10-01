import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { PlayerAvatar } from "@/components/player-avatar";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { getLeaderboard } from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Mafia" },
      { name: "description", content: "The highest ranked Mafia players by experience and win rate." },
      { property: "og:title", content: "Leaderboard — Mafia" },
      { property: "og:description", content: "The highest ranked Mafia players by experience and win rate." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { t } = useI18n();
  const { userId } = useAuth();
  const [search, setSearch] = useState("");

  const fetchBoard = useServerFn(getLeaderboard);
  const board = useQuery({
    queryKey: ["leaderboard"],
    refetchInterval: 30000,
    queryFn: () => fetchBoard(),
  });

  const rows = (board.data ?? []).filter((p) =>
    p.username.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">{t("leaderboard.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("leaderboard.sub")}</p>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("common.search")}
          className="w-full sm:w-64"
          aria-label={t("common.search")}
        />
      </header>

      <div className="panel mt-6 divide-y divide-border">
        {rows.map((p) => {
          const rank = (board.data ?? []).indexOf(p) + 1;
          const winRate = p.games_played ? Math.round((p.wins / p.games_played) * 100) : 0;
          return (
            <div
              key={p.id}
              className={cn(
                "flex items-center gap-4 px-4 py-3",
                p.id === userId && "bg-primary/10",
              )}
            >
              <span
                className={cn(
                  "w-8 shrink-0 text-center font-display text-xl",
                  rank === 1 && "text-warning",
                  rank === 2 && "text-foreground",
                  rank === 3 && "text-accent",
                  rank > 3 && "text-muted-foreground",
                )}
              >
                {rank}
              </span>
              <PlayerAvatar name={p.username} avatarKey={p.avatar_key} frameKey={p.frame_key} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.username}</div>
                <div className="text-xs text-muted-foreground">
                  {t("profile.level")} {p.level} · {winRate}% {t("profile.winRate").toLowerCase()}
                </div>
              </div>
              <span className="font-display text-lg tabular-nums">{p.xp}</span>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">No players found.</p>
        )}
      </div>
    </AppShell>
  );
}
