/**
 * Model Analytics Service v2.0
 * Tracks model performance, predictions, confidence calibration, and backtesting
 * 
 * Features:
 * - Historical backtesting with actual results
 * - Accuracy tracking by confidence bucket
 * - Match type analysis (favorites vs underdogs)
 * - League position difference tracking
 * - Automatic calibration tuning
 */

interface PredictionRecord {
  id: string;
  match: string;
  predicted: "Home" | "Away" | "Draw";
  confidence: number;
  actual?: "Home" | "Away" | "Draw";
  correct?: boolean;
  timestamp: number;
  homeTeam: string;
  awayTeam: string;
  probability?: {
    home: number;
    draw: number;
    away: number;
  };
  // NEW: Additional tracking fields
  homePosition?: number;
  awayPosition?: number;
  positionDiff?: number;
  matchType?: "home_favorite" | "away_favorite" | "even" | "underdog_pick";
  rawConfidence?: number; // Before calibration
}

interface ConfidenceBucketStats {
  total: number;
  correct: number;
  accuracy: number;
  expectedAccuracy: number; // Middle of bucket (e.g., 65% for 60-70)
  calibrationError: number; // Expected - Actual
}

interface MatchTypeStats {
  total: number;
  correct: number;
  accuracy: number;
}

interface CalibrationFactors {
  "40-50": number;
  "50-60": number;
  "60-70": number;
  "70-80": number;
  "80-90": number;
}

interface ModelMetrics {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  averageConfidence: number;
  confidenceCalibration: number;
  predictionsByOutcome: {
    homeWins: number;
    draws: number;
    awayWins: number;
  };
  confidenceBuckets: {
    "40-50": number;
    "50-60": number;
    "60-70": number;
    "70-80": number;
    "80-90": number;
  };
  recentAccuracy: number;
}

// Import persistence functions
import {
  loadCalibration,
  saveCalibration,
  loadPredictionHistory,
  addPredictionToHistory,
  recordResultInHistory,
  applyCalibration as persistentApplyCalibration,
  getAccuracyInsights,
  syncFromUserResults,
  type HistoricalPrediction,
} from './modelPersistence';

class ModelAnalytics {
  private predictions: PredictionRecord[] = [];
  private maxHistorySize = 1000; // Keep last 1000 predictions
  private calibrationFactors: CalibrationFactors = {
    "40-50": 0,
    "50-60": 0,
    "60-70": 0,
    "70-80": 0,
    "80-90": 0,
  };
  private initialized = false;

  constructor() {
    this.loadFromPersistence();
  }

  /**
   * Load calibration and history from file persistence
   */
  private loadFromPersistence(): void {
    try {
      // Load calibration factors
      const calibration = loadCalibration();
      this.calibrationFactors = calibration.factors;
      
      // Load prediction history
      const history = loadPredictionHistory();
      this.predictions = history.map(h => ({
        id: h.id,
        match: h.match,
        predicted: h.predicted,
        confidence: h.confidence,
        actual: h.actual,
        correct: h.correct,
        timestamp: new Date(h.timestamp).getTime(),
        homeTeam: h.homeTeam,
        awayTeam: h.awayTeam,
        rawConfidence: h.rawConfidence,
        homePosition: h.homePosition,
        awayPosition: h.awayPosition,
        matchType: h.matchType as PredictionRecord["matchType"],
      }));
      
      this.initialized = true;
      console.log(`[MODEL] Loaded ${this.predictions.length} predictions, calibration factors:`, this.calibrationFactors);
    } catch (error) {
      console.error("[MODEL] Error loading from persistence:", error);
    }
  }

  /**
   * Record a prediction with extended metadata
   */
  recordPrediction(
    match: string,
    predicted: "Home" | "Away" | "Draw",
    confidence: number,
    homeTeam: string,
    awayTeam: string,
    probability?: { home: number; draw: number; away: number },
    homePosition?: number,
    awayPosition?: number
  ): void {
    // Calculate match type
    const positionDiff = homePosition && awayPosition ? homePosition - awayPosition : undefined;
    let matchType: PredictionRecord["matchType"];
    
    if (positionDiff !== undefined) {
      if (positionDiff < -3 && predicted === "Home") {
        matchType = "home_favorite";
      } else if (positionDiff > 3 && predicted === "Away") {
        matchType = "away_favorite";
      } else if (Math.abs(positionDiff) <= 3) {
        matchType = "even";
      } else {
        matchType = "underdog_pick";
      }
    }

    // Apply calibration adjustment
    const rawConfidence = confidence;
    const calibratedConfidence = this.applyCalibration(confidence);

    const prediction: PredictionRecord = {
      id: `${match.replace(/\s+/g, "_")}-${Date.now()}`,
      match,
      predicted,
      confidence: calibratedConfidence,
      rawConfidence,
      timestamp: Date.now(),
      homeTeam,
      awayTeam,
      probability,
      homePosition,
      awayPosition,
      positionDiff,
      matchType,
    };

    this.predictions.push(prediction);

    // Keep only recent predictions
    if (this.predictions.length > this.maxHistorySize) {
      this.predictions = this.predictions.slice(-this.maxHistorySize);
    }

    // Persist to file
    try {
      addPredictionToHistory({
        id: prediction.id,
        match: prediction.match,
        homeTeam: prediction.homeTeam,
        awayTeam: prediction.awayTeam,
        predicted: prediction.predicted,
        confidence: prediction.confidence,
        rawConfidence: prediction.rawConfidence,
        timestamp: new Date(prediction.timestamp).toISOString(),
        homePosition: prediction.homePosition,
        awayPosition: prediction.awayPosition,
        matchType: prediction.matchType,
      });
    } catch (error) {
      console.error("[MODEL] Error persisting prediction:", error);
    }

    console.log(`[MODEL] Prediction recorded: ${match} → ${predicted} (${calibratedConfidence}% confidence, type: ${matchType || "unknown"})`);
  }

  /**
   * Apply calibration adjustment based on historical accuracy
   */
  private applyCalibration(confidence: number): number {
    const bucket = this.getConfidenceBucket(confidence);
    const adjustment = this.calibrationFactors[bucket];
    return Math.round(Math.max(35, Math.min(95, confidence + adjustment)));
  }

  /**
   * Get confidence bucket for a given confidence value
   */
  private getConfidenceBucket(confidence: number): keyof CalibrationFactors {
    if (confidence < 50) return "40-50";
    if (confidence < 60) return "50-60";
    if (confidence < 70) return "60-70";
    if (confidence < 80) return "70-80";
    return "80-90";
  }

  /**
   * Record actual result for backtesting
   */
  recordResult(
    matchIdentifier: string,
    actual: "Home" | "Away" | "Draw"
  ): boolean {
    // Find matching prediction (by match name or id)
    const prediction = this.predictions.find(
      (p) => p.id.includes(matchIdentifier) || 
             p.match.toLowerCase().includes(matchIdentifier.toLowerCase()) ||
             (p.homeTeam.toLowerCase().includes(matchIdentifier.toLowerCase()) ||
              p.awayTeam.toLowerCase().includes(matchIdentifier.toLowerCase()))
    );
    
    if (prediction && !prediction.actual) {
      prediction.actual = actual;
      prediction.correct = prediction.predicted === actual;
      console.log(`[MODEL] Result recorded: ${prediction.match} → ${actual} ${prediction.correct ? "✓" : "✗"}`);
      
      // Persist result to file and update calibration
      try {
        recordResultInHistory(matchIdentifier, actual);
      } catch (error) {
        console.error("[MODEL] Error persisting result:", error);
      }
      
      // Update in-memory calibration after every 20 results
      const completedCount = this.predictions.filter(p => p.actual).length;
      if (completedCount > 0 && completedCount % 20 === 0) {
        this.updateCalibration();
      }
      
      return true;
    }
    return false;
  }

  /**
   * Bulk import match results for backtesting
   */
  importResults(results: Array<{ match: string; actual: "Home" | "Away" | "Draw" }>): {
    imported: number;
    failed: number;
  } {
    let imported = 0;
    let failed = 0;

    results.forEach(({ match, actual }) => {
      if (this.recordResult(match, actual)) {
        imported++;
      } else {
        failed++;
      }
    });

    // Update calibration after bulk import
    this.updateCalibration();

    console.log(`[MODEL] Bulk import: ${imported} results imported, ${failed} failed`);
    return { imported, failed };
  }

  /**
   * Update calibration factors based on historical performance
   * If 70% predictions only hit 60%, reduce confidence by 10%
   */
  updateCalibration(): void {
    const bucketStats = this.getConfidenceBucketStats();
    
    Object.entries(bucketStats).forEach(([bucket, stats]) => {
      if (stats.total >= 5) { // Need at least 5 samples for reliable calibration
        // Calculate calibration error: if predicted 70% but actual 60%, error = -10
        const error = stats.accuracy - stats.expectedAccuracy;
        
        // Gradually adjust (don't over-correct)
        const adjustment = Math.round(error * 0.5); // 50% of error as adjustment
        this.calibrationFactors[bucket as keyof CalibrationFactors] = adjustment;
      }
    });

    console.log("[MODEL] Calibration updated:", this.calibrationFactors);
  }

  /**
   * Get detailed confidence bucket statistics
   */
  getConfidenceBucketStats(): Record<string, ConfidenceBucketStats> {
    const buckets: Record<string, ConfidenceBucketStats> = {
      "40-50": { total: 0, correct: 0, accuracy: 0, expectedAccuracy: 45, calibrationError: 0 },
      "50-60": { total: 0, correct: 0, accuracy: 0, expectedAccuracy: 55, calibrationError: 0 },
      "60-70": { total: 0, correct: 0, accuracy: 0, expectedAccuracy: 65, calibrationError: 0 },
      "70-80": { total: 0, correct: 0, accuracy: 0, expectedAccuracy: 75, calibrationError: 0 },
      "80-90": { total: 0, correct: 0, accuracy: 0, expectedAccuracy: 85, calibrationError: 0 },
    };

    this.predictions
      .filter((p) => p.actual)
      .forEach((p) => {
        const bucket = this.getConfidenceBucket(p.rawConfidence || p.confidence);
        buckets[bucket].total++;
        if (p.correct) buckets[bucket].correct++;
      });

    Object.keys(buckets).forEach((bucket) => {
      const stats = buckets[bucket];
      stats.accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
      stats.calibrationError = stats.expectedAccuracy - stats.accuracy;
    });

    return buckets;
  }

  /**
   * Get accuracy by match type
   */
  getMatchTypeStats(): Record<string, MatchTypeStats> {
    const types: Record<string, MatchTypeStats> = {
      home_favorite: { total: 0, correct: 0, accuracy: 0 },
      away_favorite: { total: 0, correct: 0, accuracy: 0 },
      even: { total: 0, correct: 0, accuracy: 0 },
      underdog_pick: { total: 0, correct: 0, accuracy: 0 },
    };

    this.predictions
      .filter((p) => p.actual && p.matchType)
      .forEach((p) => {
        const type = p.matchType!;
        types[type].total++;
        if (p.correct) types[type].correct++;
      });

    Object.keys(types).forEach((type) => {
      const stats = types[type];
      stats.accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    });

    return types;
  }

  /**
   * Get accuracy by position difference buckets
   */
  getPositionDiffStats(): Record<string, MatchTypeStats> {
    const diffs: Record<string, MatchTypeStats> = {
      "large_home_fav": { total: 0, correct: 0, accuracy: 0 }, // Home 5+ positions higher
      "small_home_fav": { total: 0, correct: 0, accuracy: 0 }, // Home 1-4 positions higher  
      "even_match": { total: 0, correct: 0, accuracy: 0 },     // Within 1 position
      "small_away_fav": { total: 0, correct: 0, accuracy: 0 }, // Away 1-4 positions higher
      "large_away_fav": { total: 0, correct: 0, accuracy: 0 }, // Away 5+ positions higher
    };

    this.predictions
      .filter((p) => p.actual && p.positionDiff !== undefined)
      .forEach((p) => {
        const diff = p.positionDiff!;
        let bucket: string;
        
        if (diff <= -5) bucket = "large_home_fav";
        else if (diff < -1) bucket = "small_home_fav";
        else if (diff <= 1) bucket = "even_match";
        else if (diff < 5) bucket = "small_away_fav";
        else bucket = "large_away_fav";
        
        diffs[bucket].total++;
        if (p.correct) diffs[bucket].correct++;
      });

    Object.keys(diffs).forEach((bucket) => {
      const stats = diffs[bucket];
      stats.accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    });

    return diffs;
  }

  /**
   * Get comprehensive model metrics
   */
  getMetrics(): ModelMetrics {
    const completedPredictions = this.predictions.filter((p) => p.actual);
    const recentPredictions = this.predictions.slice(-10);
    const recentCompleted = recentPredictions.filter((p) => p.actual);

    const correctCount = completedPredictions.filter((p) => p.correct).length;
    const accuracy = completedPredictions.length > 0 
      ? (correctCount / completedPredictions.length) * 100 
      : 0;

    const recentAccuracy = recentCompleted.length > 0
      ? (recentCompleted.filter((p) => p.correct).length / recentCompleted.length) * 100
      : 0;

    const avgConfidence = this.predictions.length > 0
      ? this.predictions.reduce((sum, p) => sum + p.confidence, 0) / this.predictions.length
      : 0;

    const confidenceCalibration = Math.abs(avgConfidence - accuracy);

    const predictionsByOutcome = {
      homeWins: this.predictions.filter((p) => p.predicted === "Home").length,
      draws: this.predictions.filter((p) => p.predicted === "Draw").length,
      awayWins: this.predictions.filter((p) => p.predicted === "Away").length,
    };

    const confidenceBuckets = {
      "40-50": this.predictions.filter((p) => p.confidence >= 40 && p.confidence < 50).length,
      "50-60": this.predictions.filter((p) => p.confidence >= 50 && p.confidence < 60).length,
      "60-70": this.predictions.filter((p) => p.confidence >= 60 && p.confidence < 70).length,
      "70-80": this.predictions.filter((p) => p.confidence >= 70 && p.confidence < 80).length,
      "80-90": this.predictions.filter((p) => p.confidence >= 80 && p.confidence <= 90).length,
    };

    return {
      totalPredictions: this.predictions.length,
      correctPredictions: correctCount,
      accuracy: Math.round(accuracy * 10) / 10,
      averageConfidence: Math.round(avgConfidence),
      confidenceCalibration: Math.round(confidenceCalibration * 10) / 10,
      predictionsByOutcome,
      confidenceBuckets,
      recentAccuracy: Math.round(recentAccuracy),
    };
  }

  /**
   * Get recent predictions for display
   */
  getRecentPredictions(limit: number = 10): PredictionRecord[] {
    return this.predictions.slice(-limit).reverse();
  }

  /**
   * Get predictions pending results
   */
  getPendingPredictions(): PredictionRecord[] {
    return this.predictions.filter((p) => !p.actual);
  }

  /**
   * Get accuracy by confidence bucket (legacy support)
   */
  getConfidenceAccuracyMap(): Record<string, number> {
    const bucketStats = this.getConfidenceBucketStats();
    const accuracyMap: Record<string, number> = {};
    
    Object.entries(bucketStats).forEach(([bucket, stats]) => {
      accuracyMap[bucket] = stats.accuracy;
    });

    return accuracyMap;
  }

  /**
   * Get current calibration factors
   */
  getCalibrationFactors(): CalibrationFactors {
    return { ...this.calibrationFactors };
  }

  /**
   * Manually set calibration factors
   */
  setCalibrationFactors(factors: Partial<CalibrationFactors>): void {
    this.calibrationFactors = { ...this.calibrationFactors, ...factors };
    console.log("[MODEL] Calibration factors manually set:", this.calibrationFactors);
  }

  /**
   * Export predictions for CSV
   */
  exportPredictions(): string {
    const header = "Timestamp,Match,HomeTeam,AwayTeam,Predicted,RawConfidence,CalibratedConfidence,Actual,Correct,HomePosition,AwayPosition,PositionDiff,MatchType,HomeProbability,DrawProbability,AwayProbability\n";
    const rows = this.predictions
      .map(
        (p) =>
          `${new Date(p.timestamp).toISOString()},${p.match},${p.homeTeam},${p.awayTeam},${p.predicted},${p.rawConfidence || p.confidence},${p.confidence},${p.actual || "N/A"},${p.correct ?? "N/A"},${p.homePosition || "N/A"},${p.awayPosition || "N/A"},${p.positionDiff ?? "N/A"},${p.matchType || "N/A"},${p.probability?.home || "N/A"},${p.probability?.draw || "N/A"},${p.probability?.away || "N/A"}`
      )
      .join("\n");

    return header + rows;
  }

  /**
   * Clear history (for testing)
   */
  clearHistory(): void {
    this.predictions = [];
    this.calibrationFactors = { "40-50": 0, "50-60": 0, "60-70": 0, "70-80": 0, "80-90": 0 };
    console.log("[MODEL] Prediction history and calibration cleared");
  }

  /**
   * Get accuracy insights from persistent storage
   */
  getAccuracyInsights() {
    return getAccuracyInsights();
  }

  /**
   * Sync results from user features (localStorage) into model calibration
   */
  syncUserResults(userPredictions: Array<{
    matchId: string;
    matchName: string;
    homeTeam: string;
    awayTeam: string;
    predictedWinner: "Home" | "Away" | "Draw";
    confidence: number;
    actualResult?: "Home" | "Away" | "Draw";
    wasCorrect?: boolean;
  }>) {
    const result = syncFromUserResults(userPredictions);
    
    // Reload calibration after sync
    if (result.synced > 0) {
      const calibration = loadCalibration();
      this.calibrationFactors = calibration.factors;
    }
    
    return result;
  }

  /**
   * Get dashboard summary with extended analytics
   */
  getDashboardSummary() {
    const metrics = this.getMetrics();
    const calibration = this.getConfidenceAccuracyMap();
    const bucketStats = this.getConfidenceBucketStats();
    const matchTypeStats = this.getMatchTypeStats();
    const positionStats = this.getPositionDiffStats();
    const recent = this.getRecentPredictions(5);
    const pending = this.getPendingPredictions();
    const insights = this.getAccuracyInsights();

    return {
      metrics,
      calibration,
      bucketStats,
      matchTypeStats,
      positionStats,
      calibrationFactors: this.calibrationFactors,
      recent,
      pending: pending.slice(0, 10),
      health: {
        status: metrics.accuracy > 55 ? "healthy" : metrics.accuracy > 45 ? "fair" : "poor",
        accuracy: metrics.accuracy,
        recentTrend: insights.trend,
        calibrated: Object.values(this.calibrationFactors).some(f => f !== 0),
      },
      insights,
    };
  }
}

// Export singleton
export const modelAnalytics = new ModelAnalytics();
export { ModelAnalytics, type ModelMetrics, type PredictionRecord, type ConfidenceBucketStats, type MatchTypeStats, type CalibrationFactors };
