import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setApiToken, setUnauthorizedHandler } from "./api";
import { storage } from "./storage";
import { getPushToken } from "./push";
import type { Me, User } from "./types";

const TOKEN_KEY = "halali.token";
const PUSH_KEY = "halali.pushToken";

type Session = { token: string; user: User };

type AuthCtx = {
  ready: boolean;
  signedIn: boolean;
  me: Me | undefined;
  user: User | undefined;
  refreshMe: () => Promise<unknown>;
  signIn: (s: Session) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const deviceName = () => [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || Platform.OS;
export { deviceName };

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage.get(TOKEN_KEY).then((t) => {
      setApiToken(t);
      setToken(t);
      setReady(true);
    });
  }, []);

  const clear = useCallback(async () => {
    setApiToken(null);
    setToken(null);
    await storage.remove(TOKEN_KEY);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clear();
    });
  }, [clear]);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/me"),
    enabled: !!token,
    staleTime: 30_000,
  });

  // Register this device for push notifications once signed in.
  useEffect(() => {
    if (!token) return;
    (async () => {
      const push = await getPushToken();
      if (!push) return;
      await api("/me/push-tokens", { method: "POST", body: { token: push, platform: Platform.OS } }).catch(() => {});
      await storage.set(PUSH_KEY, push);
    })();
  }, [token]);

  const signIn = useCallback(
    async (s: Session) => {
      await storage.set(TOKEN_KEY, s.token);
      setApiToken(s.token);
      setToken(s.token);
      qc.setQueryData(["me"], undefined);
      await qc.invalidateQueries();
    },
    [qc],
  );

  const signOut = useCallback(async () => {
    const pushToken = await storage.get(PUSH_KEY);
    await api("/auth/logout", { method: "POST", body: { pushToken } }).catch(() => {});
    await storage.remove(PUSH_KEY);
    await clear();
  }, [clear]);

  const value = useMemo<AuthCtx>(
    () => ({
      ready,
      signedIn: !!token,
      me: meQuery.data,
      user: meQuery.data?.user,
      refreshMe: () => meQuery.refetch(),
      signIn,
      signOut,
    }),
    [ready, token, meQuery, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
