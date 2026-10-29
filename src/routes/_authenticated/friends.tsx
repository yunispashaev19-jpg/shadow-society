import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Search, UserPlus, X, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendAction, listFriends, searchPlayers } from "@/lib/friends.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

const friendsOptions = () => queryOptions({ queryKey: ["friends"], queryFn: () => listFriends(), refetchInterval: 10000 });
export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({ meta: [
    { title: "Friends & player search — Mafia" },
    { name: "description", content: "Find Mafia players by nickname or ID and manage your friends and requests." },
    { property: "og:title", content: "Friends & player search — Mafia" },
    { property: "og:description", content: "Find Mafia players by nickname or ID and manage your friends and requests." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(friendsOptions()),
  component: FriendsPage,
});

type Player = { id: string; username: string; avatar_key: string; frame_key: string };
function FriendsPage() {
  const { t } = useI18n();
  const { userId } = useAuth();
  const { data: relationships, refetch } = useSuspenseQuery(friendsOptions());
  const search = useServerFn(searchPlayers);
  const act = useServerFn(friendAction);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Player[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  async function action(target: string, action: "request" | "accept" | "remove") {
    setBusy(true);
    try { await act({ data: { target, action } }); await refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : t("common.error")); }
    finally { setBusy(false); }
  }
  function playerRow(p: Player, controls: React.ReactNode) {
    return <li key={p.id} className="flex flex-wrap items-center gap-3 border-b border-border py-4">
      <PlayerAvatar name={p.username} avatarKey={p.avatar_key} frameKey={p.frame_key} size="sm" />
      <div className="min-w-0 flex-1"><p className="break-all font-semibold">{p.username}</p><p className="break-all font-mono text-xs text-muted-foreground">{p.id}</p></div>
      <div className="flex flex-wrap items-center gap-2">{controls}</div>
    </li>;
  }
  function section(title: string, status: "accepted" | "incoming" | "sent", empty: string) {
    const rows = relationships.filter((r) => status === "accepted" ? r.status === "accepted" : r.status === "pending" && (status === "incoming" ? r.recipient_id === userId : r.requester_id === userId));
    return <section className="mt-8"><h2 className="text-lg font-semibold">{t(title)} <span className="ml-2 text-sm text-muted-foreground">{rows.length}</span></h2>
      <ul>{rows.map((r) => playerRow({ id: r.player_id, username: r.username, avatar_key: r.avatar_key, frame_key: r.frame_key }, <>
        {status === "incoming" && <Button size="sm" disabled={busy} onClick={() => action(r.player_id, "accept")}><Check className="size-4" />{t("friends.accept")}</Button>}
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => action(r.player_id, "remove")}><X className="size-4" />{t(status === "incoming" ? "friends.decline" : status === "sent" ? "friends.cancel" : "friends.remove")}</Button>
      </>))}</ul>
      {!rows.length && <p className="mt-4 text-sm text-muted-foreground">{t(empty)}</p>}
    </section>;
  }
  return <AppShell>
    <div className="flex items-center gap-3"><Users className="size-7 text-primary" /><h1 className="font-display text-4xl">{t("friends.title")}</h1></div>
    <form className="mt-6 flex gap-2" onSubmit={async (e) => {
      e.preventDefault(); setSearching(true);
      try { setResults(await search({ data: { query: query.trim() } })); }
      catch (err) { toast.error(err instanceof Error ? err.message : t("common.error")); }
      finally { setSearching(false); }
    }}>
      <Input aria-label={t("friends.search")} placeholder={t("friends.placeholder")} value={query} onChange={(e) => setQuery(e.target.value)} minLength={2} maxLength={100} required />
      <Button type="submit" size="icon" title={t("friends.search")} aria-label={t("friends.search")} disabled={searching || query.trim().length < 2}><Search className="size-4" /></Button>
    </form>
    {results && <section className="mt-4"><ul>{results.map((p) => {
      const r = relationships.find((r) => r.player_id === p.id);
      return playerRow(p, r ? <span className="text-sm text-muted-foreground">{t(r.status === "accepted" ? "friends.accepted" : "friends.pending")}</span> : <Button size="sm" disabled={busy} onClick={() => action(p.id, "request")}><UserPlus className="size-4" />{t("friends.add")}</Button>);
    })}</ul>{!results.length && <p className="text-sm text-muted-foreground">{t("friends.noResults")}</p>}</section>}
    {section("friends.requests", "incoming", "friends.noRequests")}
    {section("friends.list", "accepted", "friends.empty")}
    {section("friends.sent", "sent", "friends.noSent")}
  </AppShell>;
}