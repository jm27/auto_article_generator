import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase/supabaseClient";
import type { Session } from "@supabase/supabase-js";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase?.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch((error) => {
        console.error("Error fetching session:", error);
        return null;
      });

    const { data: authListener } = supabase?.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event, session);
        setSession(session);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
      setSession(null);
    };
  }, []);
  return session;
}
