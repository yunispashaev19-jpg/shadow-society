import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Award } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { updateProfile } from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { levelProgress, ROLE_META, type Role } from "@/lib/game/engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Mafia" },
      { name: "description", content: "Your Mafia level, win rate, match history and achievements." },
      { property: "og:title", content: "Your profile — Mafia" },
      { property: "og:description", content: "Your Mafia level, win rate, match history and achievements." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useI18n();
  const { userId, profile, refreshProfile } = useAuth();
  const save = useServerFn(updateProfile);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  const history = useQuery({
    queryKey: ["match-history", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await supabase
        .from("match_results")
        .select("game_id, role, won, xp_earned, coins_earned, survived, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(15);
      return data ?? [];
    },
  });

  const achievements = useQuery({
    queryKey: ["achievements", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [{ data: all }, { data: mine }] = await Promise.all([
        supabase.from("achievements").select("id, name, description, icon"),
        supabase.from("user_achievements").select("achievement_id").eq("user_id", userId!),
      ]);
      const unlocked = new Set((mine ?? []).map((m) => m.achievement_id));
      return (all ?? []).map((a) => ({ ...a, unlocked: unlocked.has(a.id) }));
    },
  });

  if (!profile) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </AppShell>
    );
  }

  const progress = levelProgress(profile.xp);
  const winRate = profile.games_played ? Math.round((profile.wins / profile.games_played) * 100) : 0;
  const roleCounts: Array<[Role, number]> = [
    ["mafia", profile.mafia_games],
    ["civilian", profile.civilian_games],
    ["detective", profile.detective_games],
    ["doctor", profile.doctor_games],
  ];
  const favourite = roleCounts.reduce((a, b) => (b[1] > a[1] ? b : a));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = username.trim();
    if (!next || next === profile?.username) return;
    setBusy(true);
    try {
      await save({ data: { username: next } });
      await refreshProfile();
      setUsername("");
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <section className="panel flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-start">
        <PlayerAvatar
          name={profile.username}
          avatarKey={profile.avatar_key}
          frameKey={profile.frame_key}
          size="xl"
        />
        <div className="w-full text-center sm:text-left">
          <h1 className="font-display text-4xl">{profile.username}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("profile.level")} {profile.level} · joined{" "}
            {new Date(profile.created_at).toLocaleDateString()}
          </p>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {progress.into} / {progress.needed} XP
              </span>
              <span>
                {t("profile.level")} {profile.level + 1}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="accent-surface h-full rounded-full" style={{ width: `${Math.round((progress.into / Math.max(1, progress.needed)) * 100)}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("profile.games")} value={profile.games_played} />
        <Stat label={t("profile.wins")} value={profile.wins} />
        <Stat label={t("profile.winRate")} value={`${winRate}%`} />
        <Stat
          label={t("profile.favRole")}
          value={<span className={cn("capitalize", ROLE_META[favourite[0]].tokenClass)}>{favourite[0]}</span>}
        />
      </section>

      <section className="mt-6 panel p-5">
        <h2 className="text-lg font-semibold">{t("profile.achievements")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(achievements.data ?? []).map((a) => (
            <div
              key={a.id}
              className={cn(
                "flex items-start gap-3 rounded-xl border border-border p-3",
                a.unlocked ? "bg-surface" : "opacity-50",
              )}
            >
              <Award className={cn("mt-0.5 size-5", a.unlocked ? "text-warning" : "text-muted-foreground")} />
              <div>
                <div className="font-semibold">{a.name}</div>
                <p className="text-sm text-muted-foreground">{a.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 panel p-5">
        <h2 className="text-lg font-semibold">{t("profile.history")}</h2>
        <ul className="mt-3 divide-y divide-border">
          {(history.data ?? []).map((m) => (
            <li key={m.game_id} className="flex items-center justify-between py-3 text-sm">
              <span className={cn("capitalize", ROLE_META[m.role as Role].tokenClass)}>{m.role}</span>
              <span className={m.won ? "text-success" : "text-muted-foreground"}>
                {m.won ? "Victory" : "Defeat"}
              </span>
              <span className="text-muted-foreground">+{m.xp_earned} XP</span>
              <span className="text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</span>
            </li>
          ))}
          {(history.data ?? []).length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">No matches played yet.</li>
          )}
        </ul>
      </section>

      <section className="mt-6 panel p-5">
        <h2 className="text-lg font-semibold">Change username</h2>
        <form onSubmit={submit} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={profile.username}
              maxLength={18}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {t("profile.save")}
          </Button>
        </form>
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="panel p-4 text-center">
      <div className="font-display text-3xl">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
