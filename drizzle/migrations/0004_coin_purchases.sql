CREATE TABLE public.coin_purchases (
  session_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  pack_id text NOT NULL,
  coins integer NOT NULL CHECK (coins > 0),
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coin_purchases TO authenticated;
GRANT ALL ON public.coin_purchases TO service_role;
ALTER TABLE public.coin_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coin purchases" ON public.coin_purchases FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.credit_coin_purchase(_session_id text, _user_id uuid, _pack_id text, _coins integer, _amount_cents integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.coin_purchases (session_id, user_id, pack_id, coins, amount_cents)
  VALUES (_session_id, _user_id, _pack_id, _coins, _amount_cents)
  ON CONFLICT (session_id) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.profiles SET coins = coins + _coins, updated_at = now() WHERE id = _user_id;
  INSERT INTO public.transactions (user_id, kind, amount, reference) VALUES (_user_id, 'coin_purchase', _coins, _session_id);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.credit_coin_purchase(text, uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_coin_purchase(text, uuid, text, integer, integer) TO service_role;