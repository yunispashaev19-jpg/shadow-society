import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { joinRoom } from "@/lib/api.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/rooms")({
  head: () => ({
    meta: [
      { title: "Public rooms — Mafia" },
      { name: "description", content: "Browse open public Mafia tables and join a match." },
      { property: "og:title", content: "Public rooms — Mafia" },
      { property: "og:description", content: "Browse open public Mafia tables and join a match." },
    ],
  }),
  component: Rooms,
});

function Rooms() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const doJoin = useServerFn(joinRoom);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const rooms = useQuery({
    queryKey: ["public-rooms"],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data } = await supabase
        .from("rooms")
        .select("id, code, name, status, max_players, room_players(user_id)")
        .eq("is_private", false)
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("rooms-browser")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
        queryClient.invalidateQueries({ queryKey: ["public-rooms"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_players" }, () => {
        queryClient.invalidateQueries({ queryKey: ["public-rooms"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const list = (rooms.data ?? []).filter((r) =>
    r.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  async function join(code: string) {
    setBusy(true);
    try {
      await doJoin({ data: { code } });
      navigate({ to: "/room/$code", params: { code } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl">{t("rooms.title")}</h1>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("rooms.search")}
          aria-label={t("rooms.search")}
          className="w-full sm:w-64"
        />
      </div>

      {list.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{t("rooms.empty")}</p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {list.map((room) => {
            const count = (room.room_players as { user_id: string }[]).length;
            const full = count >= room.max_players;
            const running = room.status === "in_game";
            return (
              <li key={room.id} className="panel flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">{room.name}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="size-4" aria-hidden />
                    {count}/{room.max_players} {t("rooms.players")}
                    <span className="ml-2 font-mono text-xs tracking-widest">{room.code}</span>
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={busy || full || running}
                  onClick={() => join(room.code)}
                  className="accent-surface shrink-0 text-primary-foreground disabled:opacity-50"
                >
                  {running ? t("rooms.inGame") : full ? t("rooms.full") : t("rooms.join")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
