"use client";

import { useEffect } from "react";
import { loginPath } from "@/lib/auth/continue";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (
      !isSupabaseConfigured() ||
      window.location.pathname.startsWith("/auth")
    ) {
      return;
    }

    const supabase = createClient();
    let active = true;

    const redirectToLogin = () => {
      if (!active) {
        return;
      }

      const intended = `${window.location.pathname}${window.location.search}`;
      window.location.assign(loginPath(intended));
    };

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) {
          return;
        }

        if (error || !data.session) {
          redirectToLogin();
        }
      })
      .catch(redirectToLogin);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        redirectToLogin();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
