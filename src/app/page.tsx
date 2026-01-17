"use client";

import { useState, useEffect, useRef } from "react";
import { Navigation } from "@/components/Navigation";
import { MatchSelector } from "@/components/MatchSelector";
import { PredictionCard } from "@/components/PredictionCard";
import { PredictionHistory } from "@/components/PredictionHistory";
import { PredictionHistoryPanel, QuickStatsBadge } from "@/components/UserFeatures";
import { Footer } from "@/components/Footer";
import { useMatches } from "@/hooks/useMatches";
import { usePrediction } from "@/hooks/usePrediction";
import { usePredictionHistory } from "@/hooks/usePredictionHistory";
import { useUserFeatures } from "@/hooks/useUserFeatures";
import { Match } from "@/types";

export default function Home() {
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [showLocalHistory, setShowLocalHistory] = useState(false);
  const [autoSaveMessage, setAutoSaveMessage] = useState<string | null>(null);
  const { matches, loading: loadingMatches, error: matchesError, matchday, selectMatchday } = useMatches(18);
  const { predictions, loading: predicting, error: predictionError, predict } = usePrediction();
  const { history, loading: historyLoading, addPrediction, removeFromHistory } = usePredictionHistory();
  const { autoSavePrediction } = useUserFeatures();

  // Find the selected match object for the save button
  const selectedMatchObj: Match | null = matches.find(m => m.id === selectedMatch) || null;

  // Track last saved prediction to avoid re-saving
  const lastSavedRef = useRef<string | null>(null);

  // Auto-save predictions when they change (unless duplicate)
  useEffect(() => {
    if (predictions && selectedMatchObj) {
      const predictionKey = `${selectedMatchObj.id}-${predictions.predicted_winner}-${predictions.confidence}`;
      
      // Only auto-save if this is a new prediction
      if (lastSavedRef.current !== predictionKey) {
        const result = autoSavePrediction(
          selectedMatchObj.id,
          predictions,
          selectedMatchObj.homeTeam.name,
          selectedMatchObj.awayTeam.name,
          selectedMatchObj.utcDate
        );
        
        if (result.saved) {
          lastSavedRef.current = predictionKey;
          setAutoSaveMessage("✓ Auto-saved to history");
          setTimeout(() => setAutoSaveMessage(null), 3000);
        } else if (result.isDuplicate) {
          lastSavedRef.current = predictionKey;
          setAutoSaveMessage("ℹ Already saved (duplicate)");
          setTimeout(() => setAutoSaveMessage(null), 2000);
        }
      }
    }
  }, [predictions, selectedMatchObj, autoSavePrediction]);

  const handlePredict = () => {
    predict(selectedMatch, matchday ?? undefined);
  };

  const handleSavePrediction = async () => {
    if (predictions) {
      const success = await addPrediction(selectedMatch, predictions);
      if (success) {
        alert("✅ Prediction saved!");
      }
    }
  };

  const allErrors = matchesError || predictionError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <Navigation showLiveIndicator={!loadingMatches} />

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Sidebar */}
          <div className="lg:col-span-2 space-y-8">
            <MatchSelector
              matches={matches}
              selectedMatch={selectedMatch}
              onSelect={setSelectedMatch}
              loading={loadingMatches}
              onPredict={handlePredict}
              isPredicting={predicting}
              error={allErrors}
              matchday={matchday}
              onMatchdayChange={selectMatchday}
            />

            {/* History Toggle */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full py-3 bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
            >
              <span>{showHistory ? "📊" : "📋"}</span>
              {showHistory ? "Hide Cloud History" : "View Cloud History"} ({history.length})
            </button>

            {/* Local History Toggle with Stats */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLocalHistory(!showLocalHistory)}
                className="flex-1 py-3 bg-indigo-900/30 border border-indigo-700/50 hover:border-indigo-600/50 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
              >
                <span>{showLocalHistory ? "📈" : "📜"}</span>
                {showLocalHistory ? "Hide Local History" : "View Local History"}
              </button>
              <QuickStatsBadge />
            </div>

            {/* History Panel (Supabase) */}
            {showHistory && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                <h3 className="text-lg font-bold text-white mb-4">
                  Cloud Prediction History
                </h3>
                <PredictionHistory
                  history={history}
                  onDelete={removeFromHistory}
                  loading={historyLoading}
                />
              </div>
            )}

            {/* Local History Panel with Stats & Tracking */}
            {showLocalHistory && (
              <PredictionHistoryPanel />
            )}
          </div>

          {/* Right Content Area */}
          <div className="lg:col-span-3">
            {predictions ? (
              <div className="space-y-6">
                <PredictionCard predictions={predictions} selectedMatch={selectedMatchObj} />

                {/* Auto-save indicator */}
                {autoSaveMessage && (
                  <div className="text-center text-sm text-green-400 animate-fade-in">
                    {autoSaveMessage}
                  </div>
                )}

                {/* Save Button (Supabase Cloud) */}
                <button
                  onClick={handleSavePrediction}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <span>☁️</span>
                  Save to Cloud History
                </button>
              </div>
            ) : (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-12 border border-slate-700/50 text-center h-full flex flex-col items-center justify-center">
                <div className="text-6xl mb-4">🎯</div>
                <p className="text-slate-400 text-lg">
                  Select a match to see AI-powered predictions
                </p>
                <p className="text-slate-500 text-sm mt-2">
                  Real-time analysis powered by Premier League data
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
