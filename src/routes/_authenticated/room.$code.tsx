import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Crown, LogOut } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ChatPanel } from "@/components/chat-panel";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { joinRoom, leaveRoom, setReady, startGame, updateRoomSettings } from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { MIN_PLAYERS, maxMafiaFor, normalizeSettings } from "@/lib/game/engine";

export const Route = createFileRoute("/_authenticated/room/$code")({
  head: () => ({
    meta: [
      { title: "Room — Mafia" },
      { name: "description", content: "Your Mafia table: players, settings and the start button." },
      { property: "og:title", content: "Room — Mafia" },
      { property: "og:description", content: "Your Mafia table: players, settings and the start button." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { code } = Route.useParams();
  const { t } = useI18n();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const doReady = useServerFn(setReady);
  const doJoin = useServerFn(joinRoom);
  const doLeave = useServerFn(leaveRoom);
  const doStart = useServerFn(startGame);
  const doSettings = useServerFn(updateRoomSettings);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const room = useQuery({
    queryKey: ["room", code],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await supabase
        .from("rooms")
        .select(
          "id, code, name, host_id, is_private, status, max_players, settings, current_game_id, room_players(user_id, seat, is_ready, profiles(username, avatar_key, frame_key, level))",
        )
        .eq("code", code.toUpperCase())
        .maybeSingle();
      return data;
    },
  });

  const data = room.data;
  const roomId = data?.id;

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, () =>
        queryClient.invalidateQueries({ queryKey: ["room", code] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` },
        () => queryClient.invalidateQueries({ queryKey: ["room", code] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, code, queryClient]);

  // Opening a shared room link seats you at the table (the server still
  // enforces capacity, room status and privacy).
  const seated = Boolean(
    userId && (data?.room_players as PlayerRow[] | undefined)?.some((p) => p.user_id === userId),
  );
  const [joinError, setJoinError] = useState<string | null>(null);
  const joining = useRef(false);
  useEffect(() => {
    if (!data || seated || joining.current || data.status !== "lobby" || joinError) return;
    joining.current = true;
    doJoin({ data: { code: code.toUpperCase() } })
      .then(() => queryClient.invalidateQueries({ queryKey: ["room", code] }))
      .catch((err: unknown) => setJoinError(err instanceof Error ? err.message : "Could not join this room."))
      .finally(() => {
        joining.current = false;
      });
  }, [data, seated, code, joinError, doJoin, queryClient]);

  // Reconnect / auto-follow: when the room enters a match, everyone joins it.
  useEffect(() => {
    if (data?.status === "in_game" && data.current_game_id && seated) {
      navigate({ to: "/game/$gameId", params: { gameId: data.current_game_id } });
    }
  }, [data?.status, data?.current_game_id, seated, navigate]);

  if (room.isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </AppShell>
    );
  }

  if (!data || joinError) {
    return (
      <AppShell>
        <div className="panel p-8 text-center">
          <h1 className="font-display text-2xl">{joinError ?? "Room not found"}</h1>
          <Button className="mt-4" onClick={() => navigate({ to: "/rooms" })}>
            Browse rooms
          </Button>
        </div>
      </AppShell>
    );
  }

  const players = [...(data.room_players as PlayerRow[])].sort((a, b) => a.seat - b.seat);
  const isHost = data.host_id === userId;
  const me = players.find((p) => p.user_id === userId);
  const settings = normalizeSettings(data.settings, Math.max(players.length, MIN_PLAYERS));
  const enoughPlayers = players.length >= MIN_PLAYERS;
  const allReady = players.every((p) => p.is_ready || p.user_id === data.host_id);

  async function guard(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      queryClient.invalidateQueries({ queryKey: ["room", code] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell wide>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <h1 className="font-display text-3xl">{data.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {players.length}/{data.max_players} {t("rooms.players")} ·{" "}
                {data.is_private ? "Private" : "Public"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(data.code);
                  setCopied(true);
                  toast.success(t("room.copied"));
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-lg tracking-[0.3em] transition-colors hover:bg-surface-2"
                aria-label={t("room.copy")}
              >
                {data.code}
                {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4 text-muted-foreground" />}
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("room.leave")}
                disabled={busy}
                onClick={() =>
                  guard(async () => {
                    await doLeave({ data: { roomId: data.id } });
                    navigate({ to: "/rooms" });
                  })
                }
              >
                <LogOut className="size-5" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {players.map((p) => (
              <div key={p.user_id} className="panel flex items-center gap-3 p-4">
                <PlayerAvatar
                  name={p.profiles?.username ?? "?"}
                  avatarKey={p.profiles?.avatar_key}
                  frameKey={p.profiles?.frame_key}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{p.profiles?.username}</span>
                    {p.user_id === data.host_id && (
                      <Crown className="size-3.5 shrink-0 text-warning" aria-label={t("room.host")} />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t("profile.level")} {p.profiles?.level ?? 1}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    p.is_ready || p.user_id === data.host_id
                      ? "bg-success/15 text-success"
                      : "bg-surface-2 text-muted-foreground"
                  }`}
                >
                  {p.is_ready || p.user_id === data.host_id ? t("room.ready") : t("room.notReady")}
                </span>
              </div>
            ))}
            {Array.from({ length: Math.max(0, data.max_players - players.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center justify-center rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground"
              >
                Empty seat
              </div>
            ))}
          </div>

          <div className="panel p-5">
            <h2 className="text-lg font-semibold">{t("room.settings")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isHost ? "Only you can change these." : "Set by the host."}
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <SettingSlider
                label="Mafia"
                value={settings.mafiaCount}
                min={1}
                max={maxMafiaFor(Math.max(players.length, MIN_PLAYERS))}
                disabled={!isHost || busy}
                onCommit={(v) => guard(() => doSettings({ data: { roomId: data.id, settings: { mafiaCount: v } } }))}
              />
              <SettingSlider
                label="Night seconds"
                value={settings.nightSeconds}
                min={15}
                max={120}
                step={5}
                disabled={!isHost || busy}
                onCommit={(v) => guard(() => doSettings({ data: { roomId: data.id, settings: { nightSeconds: v } } }))}
              />
              <SettingSlider
                label="Discussion seconds"
                value={settings.discussionSeconds}
                min={30}
                max={300}
                step={10}
                disabled={!isHost || busy}
                onCommit={(v) =>
                  guard(() => doSettings({ data: { roomId: data.id, settings: { discussionSeconds: v } } }))
                }
              />
              <SettingSlider
                label="Voting seconds"
                value={settings.votingSeconds}
                min={20}
                max={180}
                step={5}
                disabled={!isHost || busy}
                onCommit={(v) => guard(() => doSettings({ data: { roomId: data.id, settings: { votingSeconds: v } } }))}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Toggle
                id="detective"
                label="Detective"
                checked={settings.detective}
                disabled={!isHost || busy}
                onChange={(v) => guard(() => doSettings({ data: { roomId: data.id, settings: { detective: v } } }))}
              />
              <Toggle
                id="doctor"
                label="Doctor"
                checked={settings.doctor}
                disabled={!isHost || busy}
                onChange={(v) => guard(() => doSettings({ data: { roomId: data.id, settings: { doctor: v } } }))}
              />
              <Toggle
                id="anon"
                label="Anonymous voting"
                checked={settings.anonymousVoting}
                disabled={!isHost || busy}
                onChange={(v) =>
                  guard(() => doSettings({ data: { roomId: data.id, settings: { anonymousVoting: v } } }))
                }
              />
              <Toggle
                id="private"
                label="Private room"
                checked={data.is_private}
                disabled={!isHost || busy}
                onChange={(v) => guard(() => doSettings({ data: { roomId: data.id, isPrivate: v } }))}
              />
            </div>
          </div>

          <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
            {isHost ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {!enoughPlayers
                    ? t("room.needPlayers", { n: MIN_PLAYERS })
                    : !allReady
                      ? "Waiting for everyone to be ready"
                      : "Everyone is ready."}
                </p>
                <Button
                  size="lg"
                  disabled={busy || !enoughPlayers || !allReady}
                  className="accent-surface text-primary-foreground disabled:opacity-50"
                  onClick={() =>
                    guard(async () => {
                      const res = (await doStart({ data: { roomId: data.id } })) as { gameId: string | null };
                      if (res.gameId) navigate({ to: "/game/$gameId", params: { gameId: res.gameId } });
                    })
                  }
                >
                  {t("room.start")}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{t("room.waiting")}</p>
                <Button
                  size="lg"
                  variant={me?.is_ready ? "secondary" : "default"}
                  disabled={busy}
                  className={me?.is_ready ? "" : "accent-surface text-primary-foreground"}
                  onClick={() => guard(() => doReady({ data: { roomId: data.id, ready: !me?.is_ready } }))}
                >
                  {me?.is_ready ? t("room.notReady") : t("room.ready")}
                </Button>
              </>
            )}
          </div>
        </div>

        <ChatPanel roomId={data.id} className="h-[60vh] lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]" />
      </div>
    </AppShell>
  );
}

interface PlayerRow {
  user_id: string;
  seat: number;
  is_ready: boolean;
  profiles: { username: string; avatar_key: string; frame_key: string; level: number } | null;
}

function SettingSlider({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  const id = `setting-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex justify-between">
        <span>{label}</span>
        <span className="text-muted-foreground">{local}</span>
      </Label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={local}
        disabled={disabled}
        onChange={(e) => setLocal(Number(e.target.value))}
        onPointerUp={() => local !== value && onCommit(local)}
        onKeyUp={() => local !== value && onCommit(local)}
        className="w-full accent-[var(--accent)] disabled:opacity-50"
      />
    </div>
  );
}

function Toggle({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
