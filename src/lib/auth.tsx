import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureProfile } from "@/lib/api.functions";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

interface AuthValue {
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const profile = await ensureProfile({ data: {} });
      return profile as Profile;
    },
  });

  const value = useMemo<AuthValue>(
    () => ({
      session,
      userId,
      profile: profileQuery.data ?? null,
      loading: !ready || (!!userId && profileQuery.isLoading),
      refreshProfile: () => queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
    }),
    [session, userId, profileQuery.data, profileQuery.isLoading, ready, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
