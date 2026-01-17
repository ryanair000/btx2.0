import { useState } from "react";
import { PredictionResult } from "@/types";
import { fetchJSON } from "@/lib/utils/apiClient";

export function usePrediction() {
  const [predictions, setPredictions] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predict = async (matchId: string, matchday?: number) => {
    // Validate matchId more robustly - ensure it's a string
    const matchIdStr = String(matchId || "");
    if (!matchIdStr || matchIdStr.trim() === "") {
      setError("Please select a match first");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await fetchJSON<PredictionResult>("/api/predict", {
        method: "POST",
        body: JSON.stringify({ matchId: matchIdStr.trim(), matchday }),
      });
      setPredictions(result);
    } catch (err) {
      // Provide more user-friendly error messages
      let errorMsg = "Prediction failed";
      if (err instanceof Error) {
        const message = err.message;
        if (message.includes("400")) {
          errorMsg = "Invalid match selection. Please select a match from the list.";
        } else if (message.includes("404")) {
          errorMsg = "Match not found. Please select a different match.";
        } else if (message.includes("502") || message.includes("503")) {
          errorMsg = "Football data service temporarily unavailable. Please try again in a moment.";
        } else if (message.includes("500")) {
          errorMsg = "Server error occurred. Please try again.";
        } else {
          errorMsg = message;
        }
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return { predictions, loading, error, predict };
}
