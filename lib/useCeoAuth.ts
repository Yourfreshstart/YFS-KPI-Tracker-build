"use client";

import { useEffect, useState, useCallback } from "react";
import { api, AUTH_LOST_EVENT } from "@/lib/api";

// Whether the CEO PIN step has been passed, and by whom, is kept by the
// server. CEO Dashboard and Lists/Admin share this hook but allow different
// people (Lists/Admin: Teather only; CEO Dashboard: Teather or Jennifer), so a
// page passes who it allows -- the server enforces the same rule on the data.
export function useCeoAuth(allowedNames: string[] = ["Teather"]) {
  const [unlockedName, setUnlockedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await api<{ ceoName: string | null }>("/api/auth/me");
      setUnlockedName(r.ok ? r.data.ceoName : null);
      setLoading(false);
    })();
    const onLost = () => setUnlockedName(null);
    window.addEventListener(AUTH_LOST_EVENT, onLost);
    return () => window.removeEventListener(AUTH_LOST_EVENT, onLost);
  }, []);

  const unlocked = !!unlockedName && allowedNames.includes(unlockedName);

  const unlock = useCallback((name: string) => {
    setUnlockedName(name);
  }, []);

  const lock = useCallback(async () => {
    setUnlockedName(null);
    await api("/api/auth/logout", { body: { ceoOnly: true } });
  }, []);

  return { unlocked, loading, unlock, lock };
}
