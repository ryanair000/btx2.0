/**
 * Hook for user features: history, favorites, stats, sharing
 */

import { useState, useEffect, useCallback } from "react";
import {
  StoredPrediction,
  PredictionStats,
  savePrediction,
  getAllPredictions,
  getPredictions,
  deletePrediction,
  toggleFavorite,
  recordActualResult,
  calculateStats,
  sharePrediction,
  copyPredictionToClipboard,
  exportPredictions,
  importPredictions,
  clearAllPredictions,
  findDuplicatePrediction,
  hasExistingPrediction,
  getPredictionsForMatch,
} from "@/lib/userFeaturesService";
import { PredictionResult } from "@/types";

export function useUserFeatures() {
  const [history, setHistory] = useState<StoredPrediction[]>([]);
  const [favorites, setFavorites] = useState<StoredPrediction[]>([]);
  const [stats, setStats] = useState<PredictionStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = useCallback(() => {
    setLoading(true);
    try {
      const allPredictions = getAllPredictions();
      setHistory(allPredictions);
      setFavorites(allPredictions.filter(p => p.isFavorite));
      setStats(calculateStats());
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Save a new prediction from PredictionResult
   */
  const saveNewPrediction = useCallback((
    matchId: string,
    prediction: PredictionResult,
    homeTeam: string,
    awayTeam: string,
    matchDate: string,
    method: string = "standard"
  ): StoredPrediction | null => {
    const bettingMarkets = prediction.bettingMarkets;
    
    const stored = savePrediction({
      matchId,
      matchName: prediction.match,
      homeTeam,
      awayTeam,
      matchDate,
      predictedWinner: prediction.predicted_winner as "Home" | "Away" | "Draw",
      confidence: prediction.confidence,
      predictedAccuracy: prediction.predicted_accuracy,
      summaryInsight: prediction.summary_insight,
      keyFactors: prediction.key_factors,
      expectedHomeGoals: bettingMarkets?.expectedHomeGoals,
      expectedAwayGoals: bettingMarkets?.expectedAwayGoals,
      overUnder25: bettingMarkets?.overUnder?.find(o => o.line === 2.5)?.recommendation,
      btts: bettingMarkets?.btts?.recommendation,
      bestBets: bettingMarkets?.bestBets,
      isFavorite: false,
      method,
    });
    
    if (stored) {
      refreshData();
    }
    return stored;
  }, [refreshData]);

  /**
   * Auto-save prediction (skips if duplicate exists)
   * Returns: { saved: boolean, isDuplicate: boolean, prediction?: StoredPrediction }
   */
  const autoSavePrediction = useCallback((
    matchId: string,
    prediction: PredictionResult,
    homeTeam: string,
    awayTeam: string,
    matchDate: string,
    method: string = "standard"
  ): { saved: boolean; isDuplicate: boolean; prediction?: StoredPrediction } => {
    const bettingMarkets = prediction.bettingMarkets;
    
    // Check for duplicate first
    const existing = findDuplicatePrediction(
      matchId,
      prediction.predicted_winner as "Home" | "Away" | "Draw",
      prediction.confidence
    );
    
    if (existing) {
      console.log(`[AutoSave] Duplicate exists, skipping save for ${prediction.match}`);
      return { saved: false, isDuplicate: true, prediction: existing };
    }
    
    const stored = savePrediction({
      matchId,
      matchName: prediction.match,
      homeTeam,
      awayTeam,
      matchDate,
      predictedWinner: prediction.predicted_winner as "Home" | "Away" | "Draw",
      confidence: prediction.confidence,
      predictedAccuracy: prediction.predicted_accuracy,
      summaryInsight: prediction.summary_insight,
      keyFactors: prediction.key_factors,
      expectedHomeGoals: bettingMarkets?.expectedHomeGoals,
      expectedAwayGoals: bettingMarkets?.expectedAwayGoals,
      overUnder25: bettingMarkets?.overUnder?.find(o => o.line === 2.5)?.recommendation,
      btts: bettingMarkets?.btts?.recommendation,
      bestBets: bettingMarkets?.bestBets,
      isFavorite: false,
      method,
    }, true); // Skip duplicate check since we already did it
    
    if (stored) {
      console.log(`[AutoSave] Saved prediction for ${prediction.match}`);
      refreshData();
      return { saved: true, isDuplicate: false, prediction: stored };
    }
    
    return { saved: false, isDuplicate: false };
  }, [refreshData]);

  /**
   * Check if prediction exists for match
   */
  const hasPrediction = useCallback((matchId: string): boolean => {
    return hasExistingPrediction(matchId);
  }, []);

  /**
   * Get predictions for a specific match
   */
  const getMatchPredictions = useCallback((matchId: string): StoredPrediction[] => {
    return getPredictionsForMatch(matchId);
  }, []);

  /**
   * Toggle favorite status
   */
  const toggleFav = useCallback((id: string) => {
    const newStatus = toggleFavorite(id);
    refreshData();
    return newStatus;
  }, [refreshData]);

  /**
   * Delete a prediction
   */
  const removePrediction = useCallback((id: string) => {
    const success = deletePrediction(id);
    if (success) refreshData();
    return success;
  }, [refreshData]);

  /**
   * Record actual match result
   */
  const recordResult = useCallback((
    id: string,
    result: "Home" | "Away" | "Draw",
    homeGoals: number,
    awayGoals: number
  ) => {
    const updated = recordActualResult(id, result, homeGoals, awayGoals);
    if (updated) refreshData();
    return updated;
  }, [refreshData]);

  /**
   * Share a prediction
   */
  const share = useCallback(async (prediction: StoredPrediction) => {
    return sharePrediction(prediction);
  }, []);

  /**
   * Copy prediction to clipboard
   */
  const copyToClipboard = useCallback(async (prediction: StoredPrediction): Promise<boolean> => {
    const success = await copyPredictionToClipboard(prediction);
    if (!success) {
      console.warn('Copy to clipboard failed - clipboard API may be blocked');
    }
    return success;
  }, []);

  /**
   * Export all data
   */
  const exportData = useCallback(() => {
    return exportPredictions();
  }, []);

  /**
   * Import data from JSON
   */
  const importData = useCallback((json: string) => {
    const result = importPredictions(json);
    if (result.success) refreshData();
    return result;
  }, [refreshData]);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    clearAllPredictions();
    refreshData();
  }, [refreshData]);

  /**
   * Get predictions with filters
   */
  const getFiltered = useCallback((options?: {
    limit?: number;
    favoritesOnly?: boolean;
    pendingOnly?: boolean;
    completedOnly?: boolean;
    method?: string;
  }) => {
    return getPredictions(options);
  }, []);

  return {
    // State
    history,
    favorites,
    stats,
    loading,
    
    // Actions
    saveNewPrediction,
    autoSavePrediction,
    hasPrediction,
    getMatchPredictions,
    toggleFavorite: toggleFav,
    removePrediction,
    recordResult,
    share,
    copyToClipboard,
    exportData,
    importData,
    clearHistory,
    getFiltered,
    refreshData,
  };
}
