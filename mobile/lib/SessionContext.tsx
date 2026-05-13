import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { api } from "./api";

interface SessionContextType {
  sessionId: string | null;
  sessionName: string | null;
  provider: string;
  setProvider: (p: string) => void;
  initSession: (name?: string) => Promise<string>;
}

const SessionContext = createContext<SessionContextType>({
  sessionId: null,
  sessionName: null,
  provider: "groq",
  setProvider: () => {},
  initSession: async () => "",
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [provider, setProvider] = useState("groq");

  const initSession = useCallback(async (name?: string) => {
    if (sessionId) return sessionId; // reuse existing
    const { session_id } = await api.createSession(name || "my-project");
    setSessionId(session_id);
    setSessionName(name || "my-project");
    return session_id;
  }, [sessionId]);

  return (
    <SessionContext.Provider value={{ sessionId, sessionName, provider, setProvider, initSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
