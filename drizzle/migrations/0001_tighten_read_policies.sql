CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_players rp WHERE rp.room_id = _room_id AND rp.user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.is_room_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_room_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.shares_table_with(_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_players a JOIN public.room_players b ON a.room_id = b.room_id
    WHERE a.user_id = auth.uid() AND b.user_id = _other
  ) OR EXISTS (
    SELECT 1 FROM public.game_players a JOIN public.game_players b ON a.game_id = b.game_id
    WHERE a.user_id = auth.uid() AND b.user_id = _other
  );
$$;
REVOKE EXECUTE ON FUNCTION public.shares_table_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_table_with(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles readable by signed in users" ON public.profiles;
CREATE POLICY "profiles readable by self and tablemates" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR public.shares_table_with(id));

DROP POLICY IF EXISTS "match results readable by signed in users" ON public.match_results;
CREATE POLICY "match results readable by self and game participants" ON public.match_results
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_game_participant(game_id));

DROP POLICY IF EXISTS "achievements readable by signed in users" ON public.user_achievements;
CREATE POLICY "own achievements" ON public.user_achievements
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rooms readable by signed in users" ON public.rooms;
CREATE POLICY "public rooms or own rooms readable" ON public.rooms
  FOR SELECT TO authenticated USING (is_private = false OR host_id = auth.uid() OR public.is_room_member(id));

DROP POLICY IF EXISTS "room players readable by signed in users" ON public.room_players;
CREATE POLICY "room players readable in public or own rooms" ON public.room_players
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.is_room_member(room_id)
    OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.is_private = false)
  );