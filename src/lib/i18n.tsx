/**
 * Minimal localization layer.
 *
 * Every user-facing string lives in a dictionary keyed by locale, so adding
 * Ukrainian / Russian / Turkish / Azerbaijani later is a matter of dropping a
 * new object into `dictionaries` — no component changes required.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export const LOCALES = ["en"] as const;
export const PLANNED_LOCALES = ["uk", "ru", "tr", "az"] as const;
export type Locale = (typeof LOCALES)[number];

const en = {
  "app.name": "MAFIA",
  "app.tagline": "Read the room. Trust no one.",

  "nav.play": "Play",
  "nav.rooms": "Rooms",
  "nav.leaderboard": "Leaderboard",
  "nav.shop": "Shop",
  "nav.profile": "Profile",
  "nav.settings": "Settings",
  "nav.signOut": "Sign out",
  "nav.signIn": "Sign in",

  "landing.headline": "A game of quiet lies",
  "landing.sub":
    "Online social deduction for 4 to 16 players. Secret roles, timed nights, and a table where every word counts.",
  "landing.play": "Play now",
  "landing.how": "How to play",
  "landing.feature.roles.title": "Hidden roles",
  "landing.feature.roles.body":
    "Mafia, Detective, Doctor and Civilians. Roles are dealt on the server and never leave it.",
  "landing.feature.live.title": "Live rooms",
  "landing.feature.live.body":
    "Public or private tables with a share code, ready checks and host-controlled settings.",
  "landing.feature.fair.title": "Fair by design",
  "landing.feature.fair.body":
    "Every action, vote and win condition is validated server-side. Cosmetics only — never advantages.",

  "auth.signIn": "Sign in",
  "auth.signUp": "Create account",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.username": "Username",
  "auth.google": "Continue with Google",
  "auth.forgot": "Forgot password?",
  "auth.haveAccount": "Already have an account?",
  "auth.noAccount": "No account yet?",
  "auth.checkEmail": "Check your inbox to confirm your address, then sign in.",
  "auth.resetSent": "If that address exists, a reset link is on its way.",

  "dash.welcome": "Welcome back",
  "dash.quickPlay": "Quick join",
  "dash.quickPlayBody": "Drop into the first open public table.",
  "dash.create": "Create room",
  "dash.createBody": "Host a table and set the rules.",
  "dash.browse": "Browse rooms",
  "dash.browseBody": "Find a public table to join.",
  "dash.joinCode": "Join with code",
  "dash.recent": "Recent matches",
  "dash.noRecent": "No matches yet. Your first table is waiting.",

  "rooms.title": "Rooms",
  "rooms.empty": "No public rooms right now. Create one.",
  "rooms.players": "players",
  "rooms.join": "Join",
  "rooms.full": "Full",
  "rooms.inGame": "In game",
  "rooms.search": "Search rooms",

  "room.code": "Room code",
  "room.copy": "Copy",
  "room.copied": "Code copied",
  "room.ready": "Ready",
  "room.notReady": "Not ready",
  "room.start": "Start game",
  "room.leave": "Leave",
  "room.host": "Host",
  "room.waiting": "Waiting for the host to start",
  "room.settings": "Game settings",
  "room.needPlayers": "Needs at least {n} players",

  "game.night": "Night",
  "game.day": "Discussion",
  "game.voting": "Voting",
  "game.results": "Results",
  "game.ended": "Match over",
  "game.round": "Round {n}",
  "game.yourRole": "Your role",
  "game.dead": "Eliminated",
  "game.alive": "Alive",
  "game.vote": "Vote",
  "game.skip": "Skip vote",
  "game.log": "Event log",
  "game.chat": "Chat",
  "game.sendPlaceholder": "Say something…",
  "game.spectating": "You were eliminated. You can watch and talk with the dead.",
  "game.waitOthers": "Waiting for the others…",

  "results.mafiaWin": "Mafia wins",
  "results.townWin": "Town wins",
  "results.summary": "Match summary",
  "results.again": "Back to room",
  "results.xp": "XP earned",
  "results.coins": "Coins earned",

  "profile.level": "Level",
  "profile.games": "Games",
  "profile.wins": "Wins",
  "profile.winRate": "Win rate",
  "profile.favRole": "Favourite role",
  "profile.history": "Match history",
  "profile.achievements": "Achievements",
  "profile.save": "Save changes",

  "leaderboard.title": "Leaderboard",
  "leaderboard.sub": "Ranked by experience this season.",

  "shop.title": "Shop",
  "shop.sub": "Cosmetics only. Nothing here changes how a match plays.",
  "shop.owned": "Owned",
  "shop.buy": "Buy",
  "shop.equip": "Equip",
  "shop.equipped": "Equipped",

  "settings.title": "Settings",
  "settings.account": "Account",
  "settings.audio": "Audio",
  "settings.notifications": "Notifications",
  "settings.accessibility": "Accessibility",
  "settings.privacy": "Privacy",
  "settings.language": "Language",

  "common.loading": "Loading…",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.error": "Something went wrong",
} as const;

export type TranslationKey = keyof typeof en;

const dictionaries: Record<Locale, Record<string, string>> = { en };

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey | string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("mafia.locale");
    if (stored && (LOCALES as readonly string[]).includes(stored)) {
      setLocaleState(stored as Locale);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem("mafia.locale", l);
  }, []);

  const t = useCallback(
    (key: TranslationKey | string, vars?: Record<string, string | number>) => {
      const dict = dictionaries[locale] ?? dictionaries.en;
      let value = dict[key] ?? dictionaries.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) value = value.replace(`{${k}}`, String(v));
      }
      return value;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
