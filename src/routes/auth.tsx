import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Mafia" },
      { name: "description", content: "Sign in or create an account to play Mafia online." },
      { property: "og:title", content: "Sign in — Mafia" },
      { property: "og:description", content: "Sign in or create an account to play Mafia online." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const { t } = useI18n();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        toast.success(t("auth.resetSent"));
        setMode("signin");
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: username.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success(t("auth.checkEmail"));
          setMode("signin");
        }
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in is unavailable right now.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="hero-surface flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-md items-center px-4">
        <Link to="/">
          <BrandMark />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 pb-16">
        <div className="panel w-full p-6 sm:p-8">
          <h1 className="font-display text-3xl">
            {mode === "signup" ? t("auth.signUp") : mode === "forgot" ? t("auth.forgot") : t("auth.signIn")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "We'll email you a link to set a new password."
              : "Your seat at the table is waiting."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="username">{t("auth.username")}</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  minLength={3}
                  maxLength={18}
                  required
                  autoComplete="nickname"
                  placeholder="nightowl"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </div>
            )}

            <Button type="submit" disabled={busy} className="accent-surface w-full text-primary-foreground">
              {mode === "signup" ? t("auth.signUp") : mode === "forgot" ? "Send reset link" : t("auth.signIn")}
            </Button>
          </form>

          {mode !== "forgot" && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={onGoogle}>
                {t("auth.google")}
              </Button>
            </>
          )}

          <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
            {mode === "signin" && (
              <>
                <button className="underline-offset-4 hover:underline" onClick={() => setMode("forgot")}>
                  {t("auth.forgot")}
                </button>
                <div>
                  {t("auth.noAccount")}{" "}
                  <button className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => setMode("signup")}>
                    {t("auth.signUp")}
                  </button>
                </div>
              </>
            )}
            {mode !== "signin" && (
              <div>
                {t("auth.haveAccount")}{" "}
                <button className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => setMode("signin")}>
                  {t("auth.signIn")}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
