"use client";

import { useEffect, useState, useCallback } from "react";
import { api, AUTH_LOST_EVENT } from "@/lib/api";

export type Person = { id: string; name: string; role: string };

// Who's signed in is decided by the server (a private cookie it sets when the
// PIN is right) -- this hook just asks it. Each page mounts its own copy, so
// a tiny localStorage "ping" tells other open tabs to ask again after someone
// signs in or switches.
const PING_KEY = "yfs_auth_ping";

export function useIdentity() {
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const r = await api<{ person: Person | null }>("/api/auth/me");
    setPerson(r.ok ? r.data.person : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    function onStorage(e: StorageEvent) {
      if (e.key === PING_KEY || e.key === null) refresh();
    }
    function onLost() {
      setPerson(null);
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(AUTH_LOST_EVENT, onLost);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AUTH_LOST_EVENT, onLost);
    };
  }, [refresh]);

  const signIn = useCallback((p: Person) => {
    setPerson(p);
    try {
      localStorage.setItem(PING_KEY, String(Date.now()));
    } catch {
      // ignore storage errors (private browsing, etc.)
    }
  }, []);

  const switchUser = useCallback(async () => {
    setPerson(null);
    await api("/api/auth/logout", { body: {} });
    try {
      localStorage.setItem(PING_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }, []);

  return { person, loading, signIn, switchUser };
}
