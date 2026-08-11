"use client";

import { useEffect, useState, useCallback } from "react";

export type Person = { id: string; name: string; role: string };

const SESSION_KEY = "yfs_session";
const SESSION_HOURS = 8;

function readSession(): Person | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const ageHours = (Date.now() - data.at) / 3600000;
    if (ageHours >= 0 && ageHours < SESSION_HOURS) return data.person;
    return null;
  } catch {
    return null;
  }
}

export function useIdentity() {
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPerson(readSession());
    setLoading(false);

    // Each page (Daily Entry / Weekly Ops / Monthly Summary) mounts its own
    // copy of this hook. Without this, switching who's signed in on one tab
    // (or one page) left every other already-open tab/page showing the old
    // person until it was manually reloaded -- the "still says Teather"
    // problem. The native `storage` event fires in OTHER tabs whenever
    // localStorage changes, so this keeps them all in sync.
    function onStorage(e: StorageEvent) {
      if (e.key === SESSION_KEY || e.key === null) {
        setPerson(readSession());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const signIn = useCallback((p: Person) => {
    setPerson(p);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ person: p, at: Date.now() }));
    } catch {
      // ignore storage errors (private browsing, etc.)
    }
  }, []);

  const switchUser = useCallback(() => {
    setPerson(null);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { person, loading, signIn, switchUser };
}
