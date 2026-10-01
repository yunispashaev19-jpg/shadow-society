import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, MessageSquareQuote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { analyzeMatchChat } from "@/lib/api.functions";
import { cn } from "@/lib/utils";

interface Analysis {
  overview: string;
  claims: { player: string; claim: string; verdict: "true" | "false" | "unverifiable" }[];
  contradictions: { players: string[]; description: string }[];
}

const VERDICT: Record<Analysis["claims"][number]["verdict"], { label: string; cls: string }> = {
  true: { label: "Held up", cls: "border-success/40 text-success" },
  false: { label: "False", cls: "border-mafia/40 text-mafia" },
  unverifiable: { label: "Unclear", cls: "border-border text-muted-foreground" },
};

export function ChatAnalysisPanel({ gameId }: { gameId: string }) {
  const queryClient = useQueryClient();
  const analyze = useServerFn(analyzeMatchChat);
  const key = ["chat-analysis", gameId];

  const existing = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase
        .from("match_chat_analyses")
        .select("analysis, message_count, created_at")
        .eq("game_id", gameId)
        .maybeSingle();
      return data;
    },
  });

  const run = useMutation({
    mutationFn: () => analyze({ data: { gameId } }),
    onSuccess: (row) => queryClient.setQueryData(key, row),
  });

  const result = existing.data?.analysis as Analysis | undefined;

  return (
    <section className="panel mt-6 p-6" aria-labelledby="chat-analysis-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="chat-analysis-title" className="flex items-center gap-2 font-display text-2xl">
            <MessageSquareQuote className="size-5 text-accent" aria-hidden />
            Table talk breakdown
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered summary of the claims made at the table and where the stories didn't add up.
          </p>
        </div>
        {!result && (
          <Button
            onClick={() => run.mutate()}
            disabled={run.isPending || existing.isLoading}
            className="accent-surface text-primary-foreground"
          >
            {run.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Analysing…
              </>
            ) : (
              "Analyse chat"
            )}
          </Button>
        )}
      </div>

      {run.isError && (
        <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-mafia">
          <AlertTriangle className="size-4" aria-hidden />
          {run.error instanceof Error ? run.error.message : "Something went wrong."}
        </p>
      )}

      {result && (
        <div className="mt-5 space-y-6 rise-in">
          <p className="text-sm leading-relaxed">{result.overview}</p>

          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Key claims</h3>
            <ul className="mt-3 space-y-2">
              {result.claims.map((c, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs", VERDICT[c.verdict].cls)}>
                    {VERDICT[c.verdict].label}
                  </span>
                  <span className="text-sm">
                    <span className="font-semibold">{c.player}</span> — {c.claim}
                  </span>
                </li>
              ))}
              {result.claims.length === 0 && <li className="text-sm text-muted-foreground">No clear claims.</li>}
            </ul>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Contradictions</h3>
            <ul className="mt-3 space-y-2">
              {result.contradictions.map((c, i) => (
                <li key={i} className="rounded-lg border border-warning/30 bg-surface p-3 text-sm">
                  <span className="font-semibold text-warning">{c.players.join(" vs ")}</span>
                  <p className="mt-1">{c.description}</p>
                </li>
              ))}
              {result.contradictions.length === 0 && (
                <li className="text-sm text-muted-foreground">No contradictions found.</li>
              )}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            Based on {existing.data?.message_count} public table messages. AI summaries can make mistakes.
          </p>
        </div>
      )}
    </section>
  );
}
