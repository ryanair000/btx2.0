import { useState, useEffect, useCallback } from "react";
import { Match } from "@/types";
import { fetchJSON } from "@/lib/utils/apiClient";

export function useMatches(initialMatchday: number | null = null) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchday, setMatchday] = useState<number | null>(initialMatchday);

  const fetchMatches = useCallback(async (md: number | null) => {
    try {
      setLoading(true);
      setError(null);
      const url = md ? `/api/matches?matchday=${md}` : "/api/matches";
      const data = await fetchJSON<{ matches: Match[] }>(url);
      setMatches(data.matches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches(matchday);
  }, [matchday, fetchMatches]);

  const selectMatchday = useCallback((md: number | null) => {
    setMatchday(md);
  }, []);

  return { matches, loading, error, matchday, selectMatchday };
}
