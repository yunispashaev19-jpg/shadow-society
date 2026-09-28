import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { LayoutGrid, Plus, Zap } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { createRoom, joinRoom, quickJoin } from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { levelProgress } from "@/lib/game/engine";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Play — Mafia" },
      { name: "description", content: "Jump into a table, create a room or join with a code." },
      { property: "og:title", content: "Play — Mafia" },
      { property: "og:description", content: "Jump into a table, create a room or join with a code." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { t } = useI18n();
  const { profile, userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const doQuickJoin = useServerFn(quickJoin);
  const doJoin = useServerFn(joinRoom);
  const doCreate = useServerFn(createRoom);

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("My table");
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(8);

  const progress = levelProgress(profile?.xp ?? 0);

  const recent = useQuery({
    queryKey: ["recent-matches", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("match_results")
        .select("id, role, won, xp_earned, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const active = useQuery({
    queryKey: ["active-session", userId],
    enabled: !!userId,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase
        .from("room_players")
        .select("rooms(code, status, current_game_id)")
        .eq("user_id", userId!)
        .maybeSingle();
      const room = (data as { rooms: { code: string; status: string; current_game_id: string | null } | null } | null)
        ?.rooms;
      return room ?? null;
    },
  });

  async function run(fn: () => Promise<{ code: string }>) {
    setBusy(true);
    try {
      const room = await fn();
      queryClient.invalidateQueries();
      navigate({ to: "/room/$code", params: { code: room.code } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      {active.data ? (
        <section className="panel mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-medium">
              {active.data.status === "in_game" ? "You have a match in progress" : "You're seated at a table"}
            </p>
            <p className="text-sm text-muted-foreground">Room {active.data.code}</p>
          </div>
          <Button
            onClick={() =>
              active.data!.status === "in_game" && active.data!.current_game_id
                ? navigate({ to: "/game/$gameId", params: { gameId: active.data!.current_game_id } })
                : navigate({ to: "/room/$code", params: { code: active.data!.code } })
            }
          >
            {active.data.status === "in_game" ? "Rejoin match" : "Back to room"}
          </Button>
        </section>
      ) : null}

      <section className="panel overflow-hidden p-6 sm:p-8">
        <p className="text-sm text-muted-foreground">{t("dash.welcome")}</p>
        <h1 className="mt-1 font-display text-4xl">{profile?.username ?? "…"}</h1>
        <div className="mt-6 max-w-sm">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">
              {t("profile.level")} {progress.level}
            </span>
            <span className="text-muted-foreground">
              {progress.into} / {progress.needed} XP
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="accent-surface h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (progress.into / progress.needed) * 100)}%` }}
            />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <button
          onClick={() => run(() => doQuickJoin({}) as Promise<{ code: string }>)}
          disabled={busy}
          className="panel group p-6 text-left transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          <Zap className="size-5 text-warning" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold">{t("dash.quickPlay")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("dash.quickPlayBody")}</p>
        </button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="panel p-6 text-left transition-transform hover:-translate-y-0.5">
              <Plus className="size-5 text-primary" aria-hidden />
              <h2 className="mt-4 text-lg font-semibold">{t("dash.create")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("dash.createBody")}</p>
            </button>
          </DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>{t("dash.create")}</DialogTitle>
              <DialogDescription>You can fine-tune the rules in the room.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="room-name">Room name</Label>
                <Input id="room-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-size">Max players: {maxPlayers}</Label>
                <input
                  id="room-size"
                  type="range"
                  min={4}
                  max={16}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
                <div>
                  <Label htmlFor="room-private">Private room</Label>
                  <p className="text-xs text-muted-foreground">Only reachable with the code.</p>
                </div>
                <Switch id="room-private" checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>
              <Button
                className="accent-surface w-full text-primary-foreground"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      doCreate({
                        data: { name, isPrivate, maxPlayers, settings: {} },
                      }) as Promise<{ code: string }>,
                  )
                }
              >
                Create room
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="panel p-6">
          <LayoutGrid className="size-5 text-accent" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold">{t("dash.joinCode")}</h2>
          <div className="mt-3 flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              aria-label={t("dash.joinCode")}
              className="uppercase tracking-widest"
            />
            <Button
              variant="secondary"
              disabled={busy || code.length < 4}
              onClick={() => run(() => doJoin({ data: { code } }) as Promise<{ code: string }>)}
            >
              Join
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">{t("dash.recent")}</h2>
        {recent.data && recent.data.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {recent.data.map((m) => (
              <li key={m.id} className="panel flex items-center justify-between p-4">
                <div>
                  <span className="text-sm font-semibold capitalize">{m.role}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">+{m.xp_earned} XP</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      m.won ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {m.won ? "Win" : "Loss"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t("dash.noRecent")}</p>
        )}
      </section>
    </AppShell>
  );
}
