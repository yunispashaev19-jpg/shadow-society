import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, HeartPulse, Moon, ShieldCheck, Users } from "lucide-react";

import heroTable from "@/assets/hero-table.jpg";
import { BrandMark } from "@/components/brand";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mafia — Online Social Deduction Game" },
      {
        name: "description",
        content:
          "Play Mafia online with friends. Hidden roles, timed night and day phases, live rooms for 4 to 16 players.",
      },
      { property: "og:title", content: "Mafia — Online Social Deduction Game" },
      {
        property: "og:description",
        content:
          "Play Mafia online with friends. Hidden roles, timed night and day phases, live rooms for 4 to 16 players.",
      },
    ],
  }),
  component: Landing,
});

const ROLES = [
  { icon: Moon, name: "Mafia", body: "Wake at night, pick a target, and lie convincingly by day.", tone: "text-mafia" },
  { icon: Eye, name: "Detective", body: "Investigate one player each night and learn their allegiance.", tone: "text-detective" },
  { icon: HeartPulse, name: "Doctor", body: "Protect one player each night — including yourself.", tone: "text-doctor" },
  { icon: Users, name: "Civilian", body: "No power but your voice. Read the table and vote well.", tone: "text-civilian" },
];

function Landing() {
  const { t } = useI18n();
  const { session } = useAuth();
  const target = session ? "/dashboard" : "/auth";

  return (
    <div className="hero-surface min-h-screen">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <BrandMark />
        <Link
          to={target}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
        >
          {session ? t("nav.play") : t("nav.signIn")}
        </Link>
      </header>

      <section className="grain relative overflow-hidden">
        <img
          src={heroTable}
          alt="An empty lamp-lit table in a dark room"
          width={1920}
          height={1088}
          className="absolute inset-0 size-full object-cover opacity-50 motion-safe:animate-[pulse_9s_ease-in-out_infinite]"
        />
        <div aria-hidden className="moon-glow pointer-events-none absolute -top-16 right-[8%] size-40 rounded-full opacity-70 sm:size-56" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/70 to-background" />
        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-36">
          <p className="rise-in glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-accent ring-pulse" aria-hidden />
            {t("app.tagline")}
          </p>
          <h1 className="rise-in mt-6 font-display text-5xl leading-[1.02] text-balance sm:text-8xl">
            <span className="text-gradient">{t("landing.headline")}</span>
          </h1>
          <p className="rise-in mx-auto mt-6 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            {t("landing.sub")}
          </p>
          <div className="rise-in mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={target}
              className="accent-surface w-full rounded-xl px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              {t("landing.play")}
            </Link>
            <Link
              to="/how-to-play"
              className="w-full rounded-xl border border-border bg-surface/70 px-8 py-3.5 text-base font-medium backdrop-blur transition-colors hover:bg-surface-2 sm:w-auto"
            >
              {t("landing.how")}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Moon, title: t("landing.feature.roles.title"), body: t("landing.feature.roles.body") },
            { icon: Users, title: t("landing.feature.live.title"), body: t("landing.feature.live.body") },
            { icon: ShieldCheck, title: t("landing.feature.fair.title"), body: t("landing.feature.fair.body") },
          ].map((f) => (
            <div key={f.title} className="panel panel-lift p-6">
              <span className="grid size-10 place-items-center rounded-lg bg-surface-2">
                <f.icon className="size-5 text-primary" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Four roles</p>
        <h2 className="mt-2 font-display text-4xl sm:text-5xl">The table</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => (
            <div key={r.name} className="panel panel-lift group relative overflow-hidden p-6">
              <r.icon className={`absolute -right-4 -bottom-4 size-24 opacity-10 transition-opacity group-hover:opacity-20 ${r.tone}`} aria-hidden />
              <r.icon className={`size-6 ${r.tone}`} aria-hidden />
              <h3 className="mt-4 font-display text-2xl">{r.name}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Mafia — an original online social deduction game.
      </footer>
    </div>
  );
}
