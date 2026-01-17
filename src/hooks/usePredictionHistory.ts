import { useState, useEffect } from "react";
import { SavedPrediction, savePrediction, getPredictions, deletePrediction } from "@/lib/supabaseClient";
import { PredictionResult } from "@/types";

export function usePredictionHistory() {
  const [history, setHistory] = useState<SavedPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPredictions();
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const addPrediction = async (
    matchId: string,
    prediction: PredictionResult
  ) => {
    try {
      setError(null);
      const saved = await savePrediction({
        match_id: matchId,
        match_name: prediction.match,
        predicted_winner: prediction.predicted_winner,
        confidence: prediction.confidence,
        predicted_accuracy: prediction.predicted_accuracy,
        summary_insight: prediction.summary_insight,
        key_factors: prediction.key_factors,
        accuracy_reason: prediction.accuracy_reason,
      });

      if (saved) {
        // Refresh history
        await fetchHistory();
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prediction");
      return false;
    }
  };

  const removeFromHistory = async (id: string) => {
    try {
      setError(null);
      const success = await deletePrediction(id);
      if (success) {
        // Update local state
        setHistory(history.filter((p) => p.id !== id));
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete prediction");
      return false;
    }
  };

  return {
    history,
    loading,
    error,
    addPrediction,
    removeFromHistory,
    refreshHistory: fetchHistory,
  };
}
