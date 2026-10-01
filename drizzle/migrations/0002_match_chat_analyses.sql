CREATE TABLE public.match_chat_analyses (
  game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_count integer NOT NULL DEFAULT 0,
  analysis jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.match_chat_analyses TO authenticated;
GRANT ALL ON public.match_chat_analyses TO service_role;
ALTER TABLE public.match_chat_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analyses readable by game participants" ON public.match_chat_analyses
  FOR SELECT TO authenticated USING (public.is_game_participant(game_id));