import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LOCALES, PLANNED_LOCALES, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Mafia" },
      { name: "description", content: "Account, audio, notification, accessibility and privacy settings." },
      { property: "og:title", content: "Settings — Mafia" },
      { property: "og:description", content: "Account, audio, notification, accessibility and privacy settings." },
    ],
  }),
  component: SettingsPage,
});

const PREF_KEY = "mafia.preferences";

interface Prefs {
  sound: boolean;
  music: boolean;
  notifications: boolean;
  reducedMotion: boolean;
  hideStats: boolean;
}

const DEFAULT_PREFS: Prefs = {
  sound: true,
  music: false,
  notifications: true,
  reducedMotion: false,
  hideStats: false,
};

function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { email } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) {
      try {
        setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) });
      } catch {
        /* ignore malformed preferences */
      }
    }
  }, []);

  function update(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    localStorage.setItem(PREF_KEY, JSON.stringify(next));
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Use at least 6 characters.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setPassword("");
      toast.success("Password updated.");
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell>
      <h1 className="font-display text-4xl">{t("settings.title")}</h1>

      <Section title={t("settings.account")}>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="text-foreground">{email}</span>
        </p>
        <form onSubmit={changePassword} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={busy}>
            Update password
          </Button>
        </form>
        <Button variant="secondary" className="mt-4" onClick={signOut}>
          {t("nav.signOut")}
        </Button>
      </Section>

      <Section title={t("settings.audio")}>
        <Row id="sound" label="Sound effects" checked={prefs.sound} onChange={(v) => update({ sound: v })} />
        <Row id="music" label="Ambient music" checked={prefs.music} onChange={(v) => update({ music: v })} />
        <p className="mt-3 text-xs text-muted-foreground">
          Voice chat is not enabled yet. The game is built to plug into a real WebRTC provider; until one is
          connected there is no voice audio, simulated or otherwise.
        </p>
      </Section>

      <Section title={t("settings.notifications")}>
        <Row
          id="notifications"
          label="In-app notifications"
          checked={prefs.notifications}
          onChange={(v) => update({ notifications: v })}
        />
      </Section>

      <Section title={t("settings.accessibility")}>
        <Row
          id="reduced-motion"
          label="Reduce motion"
          checked={prefs.reducedMotion}
          onChange={(v) => update({ reducedMotion: v })}
        />
      </Section>

      <Section title={t("settings.privacy")}>
        <Row
          id="hide-stats"
          label="Hide my stats from other players"
          checked={prefs.hideStats}
          onChange={(v) => update({ hideStats: v })}
        />
      </Section>

      <Section title={t("settings.language")}>
        <div className="flex flex-wrap gap-2">
          {LOCALES.map((l) => (
            <Button
              key={l}
              size="sm"
              variant={l === locale ? "default" : "secondary"}
              onClick={() => setLocale(l)}
            >
              {l.toUpperCase()}
            </Button>
          ))}
          {PLANNED_LOCALES.map((l) => (
            <Button key={l} size="sm" variant="ghost" disabled>
              {l.toUpperCase()} · soon
            </Button>
          ))}
        </div>
      </Section>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel mt-6 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Row({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
