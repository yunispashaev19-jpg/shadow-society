import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/brand";

export const Route = createFileRoute("/how-to-play")({
  head: () => ({
    meta: [
      { title: "How to play Mafia — Rules and roles" },
      {
        name: "description",
        content:
          "The full rules: night actions, discussion, voting and win conditions for Mafia, Detective, Doctor and Civilians.",
      },
      { property: "og:title", content: "How to play Mafia — Rules and roles" },
      {
        property: "og:description",
        content: "Night actions, discussion, voting and win conditions explained.",
      },
    ],
  }),
  component: HowToPlay,
});

const STEPS = [
  ["Roles are dealt", "Every player secretly receives a role. Only you ever see yours — roles live on the server."],
  ["Night falls", "The Mafia agree on a target. The Doctor protects someone. The Detective investigates one player."],
  ["Morning", "The table learns who survived. Nobody learns anything else for free."],
  ["Discussion", "A timed, open conversation. Accuse, defend, and read the room."],
  ["The vote", "Every living player votes. A clear plurality is eliminated and their role is revealed. A tie spares everyone."],
  ["Win check", "Town wins when no Mafia remain. Mafia win when they equal the rest of the table."],
];

function HowToPlay() {
  return (
    <div className="hero-surface min-h-screen">
      <header className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <Link to="/">
          <BrandMark />
        </Link>
        <Link
          to="/auth"
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2"
        >
          Play now
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-4xl sm:text-5xl">How to play</h1>
        <p className="mt-4 text-muted-foreground">
          Mafia is a game of hidden roles. A small, informed minority tries to outlast an uninformed
          majority. It takes 4 to 16 players and one honest timer.
        </p>

        <ol className="mt-10 space-y-4">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="panel flex gap-4 p-5">
              <span className="accent-surface grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <div>
                <h2 className="text-base font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mt-12 font-display text-2xl">Fair play</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Role assignment, night resolution, vote counting and win checks all happen on the server.
          Your client is never told a role it isn't entitled to see, so there is nothing to inspect
          your way into. Everything purchasable is cosmetic.
        </p>
      </main>
    </div>
  );
}
