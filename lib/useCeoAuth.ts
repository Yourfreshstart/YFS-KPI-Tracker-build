"use client";

import { useEffect, useState, useCallback } from "react";

const KEY = "yfs_ceo_unlocked";

export function useCeoAuth() {
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      setUnlocked(sessionStorage.getItem(KEY) === "1");
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  const unlock = useCallback(() => {
    setUnlocked(true);
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  const lock = useCallback(() => {
    setUnlocked(false);
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }, []);

  return { unlocked, loading, unlock, lock };
}
