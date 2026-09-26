import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SendHorizonal } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { sendChat } from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const CHANNEL_LABEL: Record<string, string> = {
  lobby: "Lobby",
  day: "Table",
  mafia: "Mafia",
  dead: "Graveyard",
};

export function ChatPanel({
  roomId,
  gameId = null,
  disabled = false,
  disabledHint,
  className,
}: {
  roomId: string;
  gameId?: string | null;
  disabled?: boolean;
  disabledHint?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const post = useServerFn(sendChat);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ["chat", roomId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, user_id, channel, content, created_at, profiles(username, avatar_key)")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(80);
      return (data ?? []).reverse();
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        () => queryClient.invalidateQueries({ queryKey: ["chat", roomId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, queryClient]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setBusy(true);
    try {
      await post({ data: { roomId, gameId, content } });
      setText("");
      queryClient.invalidateQueries({ queryKey: ["chat", roomId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("panel flex min-h-0 flex-col", className)}>
      <div className="border-b border-border px-4 py-3 text-sm font-semibold">{t("game.chat")}</div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {(messages.data ?? []).map((m) => {
          const author = m.profiles as { username: string } | null;
          const mine = m.user_id === userId;
          return (
            <div key={m.id} className="text-sm leading-snug">
              <span
                className={cn(
                  "font-semibold",
                  mine ? "text-primary" : "text-foreground",
                  m.channel === "mafia" && "text-mafia",
                  m.channel === "dead" && "text-muted-foreground",
                )}
              >
                {author?.username ?? "Player"}
              </span>
              {m.channel !== "lobby" && m.channel !== "day" && (
                <span className="ml-1.5 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {CHANNEL_LABEL[m.channel]}
                </span>
              )}
              <span className="ml-2 break-words text-muted-foreground">{m.content}</span>
            </div>
          );
        })}
        {(messages.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? (disabledHint ?? "Chat is closed") : t("game.sendPlaceholder")}
          maxLength={300}
          disabled={disabled || busy}
          aria-label={t("game.chat")}
        />
        <Button type="submit" size="icon" variant="secondary" disabled={disabled || busy} aria-label="Send">
          <SendHorizonal className="size-4" />
        </Button>
      </form>
    </div>
  );
}
