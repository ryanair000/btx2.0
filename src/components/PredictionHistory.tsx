"use client";

import { SavedPrediction } from "@/lib/supabaseClient";

interface PredictionHistoryProps {
  history: SavedPrediction[];
  onDelete: (id: string) => void;
  loading?: boolean;
}

export function PredictionHistory({
  history,
  onDelete,
  loading = false,
}: PredictionHistoryProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-20 bg-gray-200 rounded-lg animate-pulse"></div>
        <div className="h-20 bg-gray-200 rounded-lg animate-pulse"></div>
        <div className="h-20 bg-gray-200 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">📋 No predictions saved yet</p>
        <p className="text-gray-500 text-sm mt-2">
          Get a prediction to start building your history
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((prediction) => (
        <div
          key={prediction.id}
          className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition"
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1">
              <h4 className="text-white font-semibold text-sm">
                {prediction.match_name}
              </h4>
              <p className="text-gray-600 text-xs mt-1">
                {prediction.created_at
                  ? new Date(prediction.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Just now"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  prediction.predicted_winner === "Home"
                    ? "bg-blue-500/20 text-blue-300"
                    : prediction.predicted_winner === "Away"
                      ? "bg-purple-500/20 text-purple-300"
                      : "bg-yellow-500/20 text-yellow-300"
                }`}
              >
                {prediction.predicted_winner === "Home"
                  ? "🏠 Home"
                  : prediction.predicted_winner === "Away"
                    ? "✈️ Away"
                    : "🤝 Draw"}
              </div>

              <div
                className={`px-2 py-1 rounded text-xs font-bold ${
                  prediction.confidence >= 70
                    ? "bg-green-500/20 text-green-300"
                    : prediction.confidence >= 50
                      ? "bg-yellow-500/20 text-yellow-300"
                      : "bg-orange-500/20 text-orange-300"
                }`}
              >
                {prediction.confidence}%
              </div>

              <button
                onClick={() => prediction.id && onDelete(prediction.id)}
                className="ml-2 p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition text-sm"
                title="Delete prediction"
              >
                ✕
              </button>
            </div>
          </div>

          <p className="text-gray-700 text-xs leading-relaxed">
            {prediction.summary_insight}
          </p>
        </div>
      ))}
    </div>
  );
}
