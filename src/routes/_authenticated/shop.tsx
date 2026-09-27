import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Coins } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { purchaseItem, updateProfile } from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({
    meta: [
      { title: "Shop — Mafia" },
      { name: "description", content: "Avatars, frames and emotes. Cosmetics only, never advantages." },
      { property: "og:title", content: "Shop — Mafia" },
      { property: "og:description", content: "Avatars, frames and emotes. Cosmetics only, never advantages." },
    ],
  }),
  component: ShopPage,
});

const RARITY: Record<string, string> = {
  common: "text-muted-foreground",
  rare: "text-primary",
  epic: "text-accent",
  legendary: "text-warning",
};

function ShopPage() {
  const { t } = useI18n();
  const { userId, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const buy = useServerFn(purchaseItem);
  const equip = useServerFn(updateProfile);
  const [busy, setBusy] = useState<string | null>(null);

  const items = useQuery({
    queryKey: ["shop-items"],
    queryFn: async () => {
      const { data } = await supabase.from("shop_items").select("*").order("price");
      return data ?? [];
    },
  });

  const owned = useQuery({
    queryKey: ["user-items", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await supabase.from("user_items").select("item_id").eq("user_id", userId!);
      return new Set((data ?? []).map((r) => r.item_id));
    },
  });

  async function run(id: string, fn: () => Promise<unknown>, message: string) {
    setBusy(id);
    try {
      await fn();
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["user-items", userId] });
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  function keyOf(item: { id: string; kind: string }) {
    return item.id.replace(`${item.kind}_`, "");
  }

  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">{t("shop.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("shop.sub")}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2">
          <Coins className="size-4 text-warning" aria-hidden />
          <span className="font-semibold tabular-nums">{profile?.coins ?? 0}</span>
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(items.data ?? []).map((item) => {
          const key = keyOf(item);
          const isOwned = owned.data?.has(item.id) || key === "ash" || key === "none";
          const equipped =
            (item.kind === "avatar" && profile?.avatar_key === key) ||
            (item.kind === "frame" && profile?.frame_key === key);
          const canEquip = item.kind === "avatar" || item.kind === "frame";
          const affordable = (profile?.coins ?? 0) >= item.price;

          return (
            <article key={item.id} className="panel flex flex-col gap-4 p-5">
              <div className="flex items-center gap-4">
                <PlayerAvatar
                  name={profile?.username ?? "You"}
                  avatarKey={item.kind === "avatar" ? key : (profile?.avatar_key ?? "ash")}
                  frameKey={item.kind === "frame" ? key : "none"}
                  size="lg"
                />
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{item.name}</h2>
                  <p className={cn("text-xs uppercase tracking-wide", RARITY[item.rarity])}>{item.rarity}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Coins className="size-4 text-warning" aria-hidden />
                  {item.price === 0 ? "Free" : item.price}
                </span>
                {isOwned ? (
                  canEquip ? (
                    <Button
                      size="sm"
                      variant={equipped ? "secondary" : "default"}
                      disabled={equipped || busy === item.id}
                      onClick={() =>
                        run(
                          item.id,
                          () =>
                            equip({
                              data: item.kind === "avatar" ? { avatarKey: key } : { frameKey: key },
                            }),
                          "Equipped.",
                        )
                      }
                    >
                      {equipped ? t("shop.equipped") : t("shop.equip")}
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">{t("shop.owned")}</span>
                  )
                ) : (
                  <Button
                    size="sm"
                    className="accent-surface text-primary-foreground"
                    disabled={!affordable || busy === item.id}
                    onClick={() => run(item.id, () => buy({ data: { itemId: item.id } }), "Purchase complete.")}
                  >
                    {affordable ? t("shop.buy") : "Not enough coins"}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Coins are earned by playing. Paid currency purchases are not enabled yet — when they are, every
        transaction will be validated on the server before any balance changes.
      </p>
    </AppShell>
  );
}
