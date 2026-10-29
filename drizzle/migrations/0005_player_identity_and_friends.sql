ALTER TABLE public.profiles ADD COLUMN nickname_changes integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX profiles_nickname_ci_key ON public.profiles (lower(username));
REVOKE UPDATE (username) ON public.profiles FROM authenticated;

CREATE FUNCTION public.change_nickname(_nickname text) RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles; fee integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required.'; END IF;
  IF _nickname !~ '^[a-zA-Z0-9_]{3,18}$' THEN RAISE EXCEPTION 'Use 3–18 letters, numbers or underscores.'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found.'; END IF;
  IF p.username = _nickname THEN RETURN p; END IF;
  fee := CASE WHEN p.nickname_changes = 0 THEN 0 ELSE 25000 END;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(_nickname) AND id <> p.id) THEN RAISE EXCEPTION 'That nickname is taken.'; END IF;
  IF p.coins < fee THEN RAISE EXCEPTION 'You need 25,000 coins to change your nickname.'; END IF;
  UPDATE public.profiles SET username = _nickname, nickname_changes = nickname_changes + 1, coins = coins - fee, updated_at = now() WHERE id = p.id RETURNING * INTO p;
  INSERT INTO public.transactions(user_id, kind, amount, reference) VALUES (p.id, 'nickname_change', -fee, 'nickname_change:' || p.nickname_changes);
  RETURN p;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'That nickname is taken.';
END $$;
REVOKE ALL ON FUNCTION public.change_nickname(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_nickname(text) TO authenticated;

CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> recipient_id)
);
GRANT SELECT ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friendship participants read" ON public.friendships FOR SELECT TO authenticated USING (auth.uid() IN (requester_id, recipient_id));
CREATE UNIQUE INDEX friendships_pair_key ON public.friendships (least(requester_id, recipient_id), greatest(requester_id, recipient_id));
CREATE INDEX friendships_recipient_idx ON public.friendships (recipient_id);
CREATE INDEX friendships_requester_idx ON public.friendships (requester_id);

CREATE FUNCTION public.search_players(_query text) RETURNS TABLE (id uuid, username text, avatar_key text, frame_key text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required.'; END IF;
 IF length(trim(_query)) < 2 OR length(_query) > 100 THEN RETURN; END IF;
 RETURN QUERY SELECT p.id, p.username, p.avatar_key, p.frame_key FROM public.profiles p WHERE p.id <> auth.uid() AND (position(lower(trim(_query)) in lower(p.username)) > 0 OR p.id::text = trim(_query)) ORDER BY p.username LIMIT 20;
END $$;
REVOKE ALL ON FUNCTION public.search_players(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_players(text) TO authenticated;

CREATE FUNCTION public.list_friends() RETURNS TABLE (relationship_id uuid, requester_id uuid, recipient_id uuid, status text, player_id uuid, username text, avatar_key text, frame_key text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT f.id, f.requester_id, f.recipient_id, f.status, p.id, p.username, p.avatar_key, p.frame_key FROM public.friendships f JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = auth.uid() THEN f.recipient_id ELSE f.requester_id END WHERE auth.uid() IN (f.requester_id, f.recipient_id) ORDER BY f.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.list_friends() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_friends() TO authenticated;

CREATE FUNCTION public.friend_action(_target uuid, _action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in required.'; END IF;
 IF me = _target THEN RAISE EXCEPTION 'You cannot add yourself.'; END IF;
 IF _action = 'request' THEN
   IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = me) OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target) THEN RAISE EXCEPTION 'Player not found.'; END IF;
   IF (SELECT count(*) FROM public.friendships WHERE requester_id = me AND created_at > now() - interval '1 minute') >= 10 THEN RAISE EXCEPTION 'Too many requests. Try again later.'; END IF;
   INSERT INTO public.friendships(requester_id, recipient_id) VALUES(me, _target) ON CONFLICT DO NOTHING;
 ELSIF _action = 'accept' THEN
   UPDATE public.friendships SET status = 'accepted' WHERE requester_id = _target AND recipient_id = me AND status = 'pending';
   IF NOT FOUND THEN RAISE EXCEPTION 'Request not found.'; END IF;
 ELSIF _action = 'remove' THEN
   DELETE FROM public.friendships WHERE (requester_id = me AND recipient_id = _target) OR (requester_id = _target AND recipient_id = me);
 ELSE RAISE EXCEPTION 'Invalid action.';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.friend_action(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friend_action(uuid, text) TO authenticated;