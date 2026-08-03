"use client";

import { useEffect, useState, useCallback } from "react";

export type Person = { id: string; name: string; role: string };

const SESSION_KEY = "yfs_session";
const SESSION_HOURS = 8;

export function useIdentity() {
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const ageHours = (Date.now() - data.at) / 3600000;
        if (ageHours >= 0 && ageHours < SESSION_HOURS) {
          setPerson(data.person);
        }
      }
    } catch {
      // ignore malformed storage
    }
    setLoading(false);
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
