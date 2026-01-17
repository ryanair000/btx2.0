"use client";

import { useState } from "react";
import { useUserFeatures } from "@/hooks/useUserFeatures";
import { StoredPrediction, PredictionStats } from "@/lib/userFeaturesService";

// ============= MAIN COMPONENT =============

export function PredictionHistoryPanel() {
  const {
    history,
    favorites,
    stats,
    loading,
    toggleFavorite,
    removePrediction,
    recordResult,
    share,
    copyToClipboard,
    clearHistory,
  } = useUserFeatures();

  const [activeTab, setActiveTab] = useState<"all" | "favorites" | "pending" | "completed">("all");
  const [showStats, setShowStats] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState<string | null>(null);

  const filteredHistory = activeTab === "favorites"
    ? favorites
    : activeTab === "pending"
    ? history.filter(p => !p.actualResult)
    : activeTab === "completed"
    ? history.filter(p => p.actualResult)
    : history;

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white backdrop-blur-sm rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>📜</span> Prediction History
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showStats
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-100"
            }`}
          >
            📊 Stats
          </button>
          {history.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Clear all prediction history?")) clearHistory();
              }}
              className="px-3 py-1.5 rounded-lg text-sm bg-red-900/30 text-red-300 hover:bg-red-900/50 transition-colors"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Stats Panel */}
      {showStats && stats && (
        <StatsPanel stats={stats} />
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(["all", "favorites", "pending", "completed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-gray-100 text-white border-b-2 border-indigo-500"
                : "text-gray-600 hover:text-white hover:bg-gray-50"
            }`}
          >
            {tab === "all" && `All (${history.length})`}
            {tab === "favorites" && `⭐ (${favorites.length})`}
            {tab === "pending" && `⏳ (${history.filter(p => !p.actualResult).length})`}
            {tab === "completed" && `✓ (${history.filter(p => p.actualResult).length})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            <p className="text-4xl mb-2">📝</p>
            <p>No predictions yet</p>
            <p className="text-sm">Your saved predictions will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {filteredHistory.map((prediction) => (
              <PredictionHistoryItem
                key={prediction.id}
                prediction={prediction}
                onToggleFavorite={() => toggleFavorite(prediction.id)}
                onDelete={() => {
                  if (confirm("Delete this prediction?")) removePrediction(prediction.id);
                }}
                onShare={() => share(prediction)}
                onCopy={() => copyToClipboard(prediction)}
                onRecordResult={() => setShowRecordModal(prediction.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Record Result Modal */}
      {showRecordModal && (
        <RecordResultModal
          prediction={history.find(p => p.id === showRecordModal)!}
          onClose={() => setShowRecordModal(null)}
          onSave={(result, homeGoals, awayGoals) => {
            recordResult(showRecordModal, result, homeGoals, awayGoals);
            setShowRecordModal(null);
          }}
        />
      )}
    </div>
  );
}

// ============= STATS PANEL =============

function StatsPanel({ stats }: { stats: PredictionStats }) {
  return (
    <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {/* Overall Accuracy */}
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{stats.accuracy.toFixed(1)}%</p>
          <p className="text-xs text-gray-600">Overall Accuracy</p>
          <p className="text-xs text-gray-500">{stats.correctPredictions}/{stats.correctPredictions + stats.incorrectPredictions}</p>
        </div>

        {/* Last 10 */}
        <div className="bg-white rounded-lg p-3 text-center">
          <p className={`text-2xl font-bold ${stats.last10Accuracy >= 60 ? "text-green-400" : stats.last10Accuracy >= 40 ? "text-yellow-400" : "text-red-400"}`}>
            {stats.last10Accuracy.toFixed(0)}%
          </p>
          <p className="text-xs text-gray-600">Last 10</p>
        </div>

        {/* Streak */}
        <div className="bg-white rounded-lg p-3 text-center">
          <p className={`text-2xl font-bold ${stats.streak.type === "win" ? "text-green-400" : stats.streak.type === "loss" ? "text-red-400" : "text-gray-600"}`}>
            {stats.streak.count > 0 ? `${stats.streak.count}${stats.streak.type === "win" ? "W" : "L"}` : "-"}
          </p>
          <p className="text-xs text-gray-600">Streak</p>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">{stats.pendingResults}</p>
          <p className="text-xs text-gray-600">Pending</p>
        </div>
      </div>

      {/* By Outcome Type */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-sm text-blue-300">{stats.homeWinAccuracy.toFixed(0)}%</p>
          <p className="text-xs text-gray-600">Home Wins</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-yellow-300">{stats.drawAccuracy.toFixed(0)}%</p>
          <p className="text-xs text-gray-600">Draws</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-purple-300">{stats.awayWinAccuracy.toFixed(0)}%</p>
          <p className="text-xs text-gray-600">Away Wins</p>
        </div>
      </div>

      {/* Confidence Analysis */}
      <div className="mt-4 text-xs text-gray-600 text-center">
        Avg confidence: {stats.averageConfidence.toFixed(0)}% | 
        When correct: {stats.avgConfidenceWhenCorrect.toFixed(0)}% | 
        When wrong: {stats.avgConfidenceWhenWrong.toFixed(0)}%
      </div>
    </div>
  );
}

// ============= PREDICTION ITEM =============

function PredictionHistoryItem({
  prediction,
  onToggleFavorite,
  onDelete,
  onShare,
  onCopy,
  onRecordResult,
}: {
  prediction: StoredPrediction;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onShare: () => void;
  onCopy: () => Promise<boolean>;
  onRecordResult: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const handleCopy = async () => {
    const success = await onCopy();
    if (success) {
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 3000);
    }
  };

  const winnerLabel =
    prediction.predictedWinner === "Home" ? prediction.homeTeam :
    prediction.predictedWinner === "Away" ? prediction.awayTeam :
    "Draw";

  const resultIcon = prediction.wasCorrect === true ? "✅" : prediction.wasCorrect === false ? "❌" : "⏳";

  return (
    <div
      className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => setShowActions(!showActions)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{resultIcon}</span>
            <span className="font-medium text-white">{prediction.matchName}</span>
            {prediction.isFavorite && <span>⭐</span>}
          </div>
          
          <div className="flex items-center gap-3 text-sm">
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              prediction.predictedWinner === "Home" 
                ? "bg-blue-500/20 text-blue-300"
                : prediction.predictedWinner === "Away"
                ? "bg-purple-500/20 text-purple-300"
                : "bg-yellow-500/20 text-yellow-300"
            }`}>
              {winnerLabel}
            </span>
            <span className="text-gray-600">{prediction.confidence}%</span>
            
            {prediction.actualResult && (
              <span className="text-gray-700">
                Result: {prediction.actualHomeGoals}-{prediction.actualAwayGoals}
              </span>
            )}
          </div>

          {/* Betting summary */}
          {(prediction.overUnder25 || prediction.btts) && (
            <div className="flex gap-2 mt-2 text-xs">
              {prediction.overUnder25 && prediction.overUnder25 !== "SKIP" && (
                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  O/U 2.5: {prediction.overUnder25}
                </span>
              )}
              {prediction.btts && prediction.btts !== "SKIP" && (
                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  BTTS: {prediction.btts}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="text-right text-xs text-gray-500">
          {new Date(prediction.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="mt-3 pt-3 border-t border-slate-700/30 flex gap-2 flex-wrap">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className="px-3 py-1.5 rounded-lg text-xs bg-gray-200 hover:bg-gray-100 transition-colors"
          >
            {prediction.isFavorite ? "★ Unfavorite" : "☆ Favorite"}
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              copyError 
                ? "bg-red-100 text-red-700 border border-red-300" 
                : copied 
                  ? "bg-green-100 text-green-700" 
                  : "bg-gray-200 hover:bg-gray-100 text-gray-700"
            }`}
          >
            {copyError ? "❌ Copy Failed" : copied ? "✓ Copied!" : "📋 Copy"}
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            className="px-3 py-1.5 rounded-lg text-xs bg-gray-200 hover:bg-gray-100 transition-colors"
          >
            📤 Share
          </button>
          
          {!prediction.actualResult && (
            <button
              onClick={(e) => { e.stopPropagation(); onRecordResult(); }}
              className="px-3 py-1.5 rounded-lg text-xs bg-green-900/50 text-green-300 hover:bg-green-900/70 transition-colors"
            >
              📝 Record Result
            </button>
          )}
          
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="px-3 py-1.5 rounded-lg text-xs bg-red-900/30 text-red-300 hover:bg-red-900/50 transition-colors"
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ============= RECORD RESULT MODAL =============

function RecordResultModal({
  prediction,
  onClose,
  onSave,
}: {
  prediction: StoredPrediction;
  onClose: () => void;
  onSave: (result: "Home" | "Away" | "Draw", homeGoals: number, awayGoals: number) => void;
}) {
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);

  const result: "Home" | "Away" | "Draw" =
    homeGoals > awayGoals ? "Home" : homeGoals < awayGoals ? "Away" : "Draw";

  const isCorrect = result === prediction.predictedWinner;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full border border-gray-200 shadow-lg">
        <h3 className="text-lg font-bold text-white mb-4">Record Match Result</h3>
        <p className="text-gray-700 mb-4">{prediction.matchName}</p>
        
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">{prediction.homeTeam}</p>
            <input
              type="number"
              min="0"
              max="15"
              value={homeGoals}
              onChange={(e) => setHomeGoals(parseInt(e.target.value) || 0)}
              className="w-16 h-16 text-center text-2xl font-bold bg-gray-200 border border-slate-600 rounded-lg text-white"
            />
          </div>
          <span className="text-2xl text-gray-600">-</span>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">{prediction.awayTeam}</p>
            <input
              type="number"
              min="0"
              max="15"
              value={awayGoals}
              onChange={(e) => setAwayGoals(parseInt(e.target.value) || 0)}
              className="w-16 h-16 text-center text-2xl font-bold bg-gray-200 border border-slate-600 rounded-lg text-white"
            />
          </div>
        </div>

        <div className={`p-3 rounded-lg mb-4 text-center ${isCorrect ? "bg-green-900/30 border border-green-600/30" : "bg-red-900/30 border border-red-600/30"}`}>
          <p className="text-sm">
            Prediction: <span className="font-bold">{prediction.predictedWinner}</span>
          </p>
          <p className={`font-bold ${isCorrect ? "text-green-400" : "text-red-400"}`}>
            {isCorrect ? "✅ Correct!" : "❌ Incorrect"}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(result, homeGoals, awayGoals)}
            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
          >
            Save Result
          </button>
        </div>
      </div>
    </div>
  );
}

// ============= SAVE PREDICTION BUTTON =============

export function SavePredictionButton({
  matchId,
  prediction,
  homeTeam,
  awayTeam,
  matchDate,
  onSaved,
}: {
  matchId: string;
  prediction: any;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  onSaved?: () => void;
}) {
  const { saveNewPrediction, history } = useUserFeatures();
  const [saved, setSaved] = useState(false);

  // Check if already saved
  const alreadySaved = history.some(p => p.matchId === matchId);

  const handleSave = () => {
    if (!alreadySaved) {
      saveNewPrediction(matchId, prediction, homeTeam, awayTeam, matchDate);
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    }
  };

  if (alreadySaved || saved) {
    return (
      <button
        disabled
        className="px-4 py-2 rounded-lg bg-green-900/30 text-green-300 border border-green-600/30 cursor-default flex items-center gap-2"
      >
        <span>✓</span> Saved
      </button>
    );
  }

  return (
    <button
      onClick={handleSave}
      className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors flex items-center gap-2"
    >
      <span>💾</span> Save Prediction
    </button>
  );
}

// ============= QUICK STATS BADGE =============

export function QuickStatsBadge() {
  const { stats } = useUserFeatures();

  if (!stats || stats.totalPredictions === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full text-xs">
      <span className={`font-bold ${stats.accuracy >= 60 ? "text-green-400" : stats.accuracy >= 40 ? "text-yellow-400" : "text-red-400"}`}>
        {stats.accuracy.toFixed(0)}%
      </span>
      <span className="text-gray-600">accuracy</span>
      <span className="text-gray-400">|</span>
      <span className="text-gray-700">{stats.correctPredictions + stats.incorrectPredictions} tracked</span>
    </div>
  );
}
