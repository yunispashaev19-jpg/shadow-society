-- ============ ENUMS ============
CREATE TYPE public.game_role AS ENUM ('mafia','civilian','detective','doctor');
CREATE TYPE public.game_phase AS ENUM ('lobby','night','day','voting','results','ended');
CREATE TYPE public.room_status AS ENUM ('lobby','in_game','closed');
CREATE TYPE public.chat_channel AS ENUM ('lobby','day','mafia','dead');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  avatar_key text NOT NULL DEFAULT 'ash',
  frame_key text NOT NULL DEFAULT 'none',
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  coins integer NOT NULL DEFAULT 250,
  games_played integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  mafia_games integer NOT NULL DEFAULT 0,
  civilian_games integer NOT NULL DEFAULT 0,
  detective_games integer NOT NULL DEFAULT 0,
  doctor_games integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (username, avatar_key, frame_key, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by signed in users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile cosmetic updates" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ ROOMS ============
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_private boolean NOT NULL DEFAULT false,
  status public.room_status NOT NULL DEFAULT 'lobby',
  max_players integer NOT NULL DEFAULT 8 CHECK (max_players BETWEEN 4 AND 16),
  settings jsonb NOT NULL DEFAULT '{"mafiaCount":2,"detective":true,"doctor":true,"nightSeconds":35,"discussionSeconds":90,"votingSeconds":45,"resultsSeconds":12,"anonymousVoting":false,"voiceEnabled":false}'::jsonb,
  current_game_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms readable by signed in users" ON public.rooms FOR SELECT TO authenticated USING (true);

CREATE TABLE public.room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_ready boolean NOT NULL DEFAULT false,
  seat integer NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id),
  UNIQUE (room_id, seat)
);
GRANT SELECT ON public.room_players TO authenticated;
GRANT ALL ON public.room_players TO service_role;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room players readable by signed in users" ON public.room_players FOR SELECT TO authenticated USING (true);

-- ============ GAMES ============
CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round integer NOT NULL DEFAULT 1,
  phase public.game_phase NOT NULL DEFAULT 'night',
  phase_ends_at timestamptz NOT NULL DEFAULT now() + interval '35 seconds',
  version integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  winner text,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
ALTER TABLE public.rooms ADD CONSTRAINT rooms_current_game_fk FOREIGN KEY (current_game_id) REFERENCES public.games(id) ON DELETE SET NULL;
GRANT SELECT ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seat integer NOT NULL,
  alive boolean NOT NULL DEFAULT true,
  eliminated_round integer,
  left_game boolean NOT NULL DEFAULT false,
  UNIQUE (game_id, user_id),
  UNIQUE (game_id, seat)
);
GRANT SELECT ON public.game_players TO authenticated;
GRANT ALL ON public.game_players TO service_role;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

-- security definer helper (must exist before policies referencing it)
CREATE OR REPLACE FUNCTION public.is_game_participant(_game_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.game_players gp WHERE gp.game_id = _game_id AND gp.user_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.is_game_participant(uuid) TO authenticated;

CREATE POLICY "games readable by participants" ON public.games FOR SELECT TO authenticated USING (public.is_game_participant(id));
CREATE POLICY "game players readable by participants" ON public.game_players FOR SELECT TO authenticated USING (public.is_game_participant(game_id));

-- SECRET ROLES: only the owner may ever read their own role row.
CREATE TABLE public.game_roles (
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.game_role NOT NULL,
  PRIMARY KEY (game_id, user_id)
);
GRANT SELECT ON public.game_roles TO authenticated;
GRANT ALL ON public.game_roles TO service_role;
ALTER TABLE public.game_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own role only" ON public.game_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- actions are never readable by clients; resolved server-side only
CREATE TABLE public.game_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round integer NOT NULL,
  phase public.game_phase NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, round, phase, actor_id, kind)
);
GRANT ALL ON public.game_actions TO service_role;
ALTER TABLE public.game_actions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.game_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round integer NOT NULL,
  phase public.game_phase NOT NULL,
  kind text NOT NULL,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  audience uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_events TO authenticated;
GRANT ALL ON public.game_events TO service_role;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events readable by their audience" ON public.game_events FOR SELECT TO authenticated
  USING (public.is_game_participant(game_id) AND (audience IS NULL OR audience = auth.uid()));

-- ============ CHAT ============
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  game_id uuid REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel public.chat_channel NOT NULL DEFAULT 'lobby',
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_room_idx ON public.chat_messages (room_id, created_at DESC);
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_chat(_room_id uuid, _game_id uuid, _channel public.chat_channel)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_players rp WHERE rp.room_id = _room_id AND rp.user_id = auth.uid())
    AND (
      _channel IN ('lobby','day')
      OR (_channel = 'mafia' AND EXISTS (SELECT 1 FROM public.game_roles gr WHERE gr.game_id = _game_id AND gr.user_id = auth.uid() AND gr.role = 'mafia'))
      OR (_channel = 'dead' AND EXISTS (SELECT 1 FROM public.game_players gp WHERE gp.game_id = _game_id AND gp.user_id = auth.uid() AND gp.alive = false))
    );
$$;
GRANT EXECUTE ON FUNCTION public.can_read_chat(uuid, uuid, public.chat_channel) TO authenticated;
CREATE POLICY "chat readable by allowed channel members" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.can_read_chat(room_id, game_id, channel));

-- ============ REPORTS ============
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ============ ECONOMY ============
CREATE TABLE public.shop_items (
  id text PRIMARY KEY,
  kind text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  price integer NOT NULL,
  rarity text NOT NULL DEFAULT 'common'
);
GRANT SELECT ON public.shop_items TO authenticated;
GRANT SELECT ON public.shop_items TO anon;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop items are public" ON public.shop_items FOR SELECT USING (true);

CREATE TABLE public.user_items (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
GRANT SELECT ON public.user_items TO authenticated;
GRANT ALL ON public.user_items TO service_role;
ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inventory" ON public.user_items FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount integer NOT NULL,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ ACHIEVEMENTS ============
CREATE TABLE public.achievements (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'award'
);
GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements are public" ON public.achievements FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_achievements (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id text NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements readable by signed in users" ON public.user_achievements FOR SELECT TO authenticated USING (true);

-- ============ MATCH RESULTS ============
CREATE TABLE public.match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.game_role NOT NULL,
  won boolean NOT NULL,
  xp_earned integer NOT NULL DEFAULT 0,
  coins_earned integer NOT NULL DEFAULT 0,
  survived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, user_id)
);
GRANT SELECT ON public.match_results TO authenticated;
GRANT ALL ON public.match_results TO service_role;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match results readable by signed in users" ON public.match_results FOR SELECT TO authenticated USING (true);

-- ============ REALTIME ============
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_players REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.game_players REPLICA IDENTITY FULL;
ALTER TABLE public.game_events REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- ============ SEED ============
INSERT INTO public.shop_items (id, kind, name, description, price, rarity) VALUES
  ('avatar_ash','avatar','Ash','The quiet one at the back of the room.',0,'common'),
  ('avatar_vela','avatar','Vela','Moonlit and unreadable.',400,'rare'),
  ('avatar_corvus','avatar','Corvus','Watches more than he speaks.',400,'rare'),
  ('avatar_juno','avatar','Juno','Always the first to accuse.',650,'epic'),
  ('avatar_sable','avatar','Sable','Never been caught.',900,'legendary'),
  ('frame_slate','frame','Slate Frame','A clean brushed-steel border.',300,'common'),
  ('frame_moonlit','frame','Moonlit Frame','Soft blue glow around your portrait.',700,'rare'),
  ('frame_violet','frame','Violet Frame','Deep violet aura for veterans.',1200,'epic'),
  ('emote_suspect','emote','Suspicious','Raise an eyebrow in the lobby.',200,'common'),
  ('emote_innocent','emote','Innocent','Protest your innocence in style.',200,'common');

INSERT INTO public.achievements (id, name, description, icon) VALUES
  ('first_blood','First Night','Play your first match.','moon'),
  ('first_win','Verdict','Win your first match.','trophy'),
  ('mafia_master','Made Man','Win 5 matches as Mafia.','skull'),
  ('sharp_eye','Sharp Eye','Win 5 matches as Detective.','search'),
  ('lifesaver','Lifesaver','Win 5 matches as Doctor.','heart-pulse'),
  ('veteran','Veteran','Play 25 matches.','shield');