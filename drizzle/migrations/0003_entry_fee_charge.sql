CREATE OR REPLACE FUNCTION public.charge_entry_fees(_game_id uuid, _user_ids uuid[], _fee integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE short_count integer;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = ANY(_user_ids) FOR UPDATE;
  SELECT count(*) INTO short_count FROM public.profiles WHERE id = ANY(_user_ids) AND coins < _fee;
  IF short_count > 0 THEN RAISE EXCEPTION 'insufficient_coins'; END IF;
  UPDATE public.profiles SET coins = coins - _fee, updated_at = now() WHERE id = ANY(_user_ids);
  INSERT INTO public.transactions (user_id, kind, amount, reference)
  SELECT u, 'entry_fee', -_fee, _game_id::text FROM unnest(_user_ids) u;
END $$;
REVOKE ALL ON FUNCTION public.charge_entry_fees(uuid, uuid[], integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_entry_fees(uuid, uuid[], integer) TO service_role;