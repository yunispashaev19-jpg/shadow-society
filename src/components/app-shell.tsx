import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Coins, Gamepad2, LayoutGrid, LogOut, Settings, ShoppingBag, Trophy, User } from "lucide-react";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand";
import { PlayerAvatar } from "@/components/player-avatar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { levelProgress } from "@/lib/game/engine";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", icon: Gamepad2, key: "nav.play" },
  { to: "/rooms", icon: LayoutGrid, key: "nav.rooms" },
  { to: "/leaderboard", icon: Trophy, key: "nav.leaderboard" },
  { to: "/shop", icon: ShoppingBag, key: "nav.shop" },
  { to: "/profile", icon: User, key: "nav.profile" },
] as const;

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const progress = levelProgress(profile?.xp ?? 0);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="hero-surface min-h-screen">
      <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
        <div
          className={cn(
            "mx-auto flex h-16 items-center gap-4 px-4 sm:px-6",
            wide ? "max-w-[1600px]" : "max-w-6xl",
          )}
        >
          <Link to="/dashboard" className="shrink-0">
            <BrandMark />
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                activeProps={{ className: "bg-surface-2 text-foreground" }}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold sm:inline-flex">
              <Coins className="size-4 text-warning" aria-hidden />
              {profile?.coins ?? 0}
            </span>
            <Link to="/settings" aria-label={t("nav.settings")} className="hidden sm:block">
              <Settings className="size-5 text-muted-foreground transition-colors hover:text-foreground" />
            </Link>
            <button onClick={signOut} aria-label={t("nav.signOut")} className="hidden sm:block">
              <LogOut className="size-5 text-muted-foreground transition-colors hover:text-foreground" />
            </button>
            <Link to="/profile" className="flex items-center gap-2">
              <div className="hidden text-right leading-tight sm:block">
                <div className="text-sm font-semibold">{profile?.username ?? "…"}</div>
                <div className="text-[11px] text-muted-foreground">
                  {t("profile.level")} {progress.level}
                </div>
              </div>
              <PlayerAvatar
                name={profile?.username ?? "?"}
                avatarKey={profile?.avatar_key}
                frameKey={profile?.frame_key}
                size="sm"
              />
            </Link>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto w-full px-4 pb-28 pt-6 sm:px-6 md:pb-12",
          wide ? "max-w-[1600px]" : "max-w-6xl",
        )}
      >
        {children}
      </main>

      <nav className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground transition-colors"
              activeProps={{ className: "text-foreground" }}
            >
              <item.icon className="size-5" aria-hidden />
              {t(item.key)}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
