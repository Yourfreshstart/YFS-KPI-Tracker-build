"use client";

import { useEffect, useState, useCallback } from "react";

// Stores WHO unlocked it, not just a yes/no flag -- CEO Dashboard and
// Lists/Admin share this hook but allow different people (Lists/Admin is
// Teather-only; CEO Dashboard also allows Jennifer as of 2026-09-24), so a
// page needs to know whose PIN was actually entered, not just that *some*
// valid PIN was entered somewhere.
const KEY = "yfs_ceo_unlocked_name";

export function useCeoAuth(allowedNames: string[] = ["Teather"]) {
  const [unlockedName, setUnlockedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      setUnlockedName(sessionStorage.getItem(KEY));
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  const unlocked = !!unlockedName && allowedNames.includes(unlockedName);

  const unlock = useCallback((name: string) => {
    setUnlockedName(name);
    try {
      sessionStorage.setItem(KEY, name);
    } catch {
      // ignore
    }
  }, []);

  const lock = useCallback(() => {
    setUnlockedName(null);
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }, []);

  return { unlocked, loading, unlock, lock };
}
