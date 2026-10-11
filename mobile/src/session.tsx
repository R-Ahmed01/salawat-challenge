import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createApi } from './api';
import { clearSession, defaultServer, loadSession, savePlayer, saveToken } from './storage';

type SessionValue = {
  ready: boolean;
  server: string;
  token: string | null;
  playerToken: string | null;
  api: ReturnType<typeof createApi>;
  signIn: (token: string) => Promise<void>;
  setPlayer: (playerToken: string | null) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [server, setServerState] = useState(defaultServer);
  const [token, setToken] = useState<string | null>(null);
  const [playerToken, setPlayerToken] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    loadSession()
      .then((saved) => {
        if (gone) return;
        setServerState(saved.server);
        setToken(saved.token);
        setPlayerToken(saved.playerToken);
        setReady(true);
      })
      .catch(() => {
        if (!gone) setReady(true);
      });
    return () => {
      gone = true;
    };
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      server,
      token,
      playerToken,
      api: createApi(server, token, playerToken),
      signIn: async (next) => {
        setToken(next);
        setPlayerToken(null);
        await saveToken(next);
      },
      setPlayer: async (next) => {
        setPlayerToken(next);
        await savePlayer(next);
      },
      signOut: async () => {
        setToken(null);
        setPlayerToken(null);
        await clearSession();
      },
    }),
    [playerToken, ready, server, token],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('Session is missing.');
  return value;
}
