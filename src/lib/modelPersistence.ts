/**
 * Model Persistence Service
 * 
 * Persists model calibration and accuracy data to file system
 * so the model can learn from past predictions across server restarts.
 * 
 * This bridges the gap between user-tracked results (localStorage)
 * and model calibration (which was previously in-memory only).
 */

import * as fs from 'fs';
import * as path from 'path';

// ============= INTERFACES =============

export interface CalibrationData {
  factors: {
    "40-50": number;
    "50-60": number;
    "60-70": number;
    "70-80": number;
    "80-90": number;
  };
  bucketStats: {
    [key: string]: {
      total: number;
      correct: number;
      accuracy: number;
    };
  };
  matchTypeStats: {
    [key: string]: {
      total: number;
      correct: number;
      accuracy: number;
    };
  };
  lastUpdated: string;
  totalResults: number;
}

export interface HistoricalPrediction {
  id: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  predicted: "Home" | "Away" | "Draw";
  confidence: number;
  rawConfidence?: number;
  actual?: "Home" | "Away" | "Draw";
  correct?: boolean;
  timestamp: string;
  homePosition?: number;
  awayPosition?: number;
  matchType?: string;
}

export interface ModelState {
  calibration: CalibrationData;
  predictions: HistoricalPrediction[];
  version: string;
}

// ============= FILE PATHS =============

const DATA_DIR = path.join(process.cwd(), 'data');
const CALIBRATION_FILE = path.join(DATA_DIR, 'model_calibration.json');
const HISTORY_FILE = path.join(DATA_DIR, 'prediction_history.json');

// ============= DEFAULT VALUES =============

const DEFAULT_CALIBRATION: CalibrationData = {
  factors: {
    "40-50": 0,
    "50-60": 0,
    "60-70": 0,
    "70-80": 0,
    "80-90": 0,
  },
  bucketStats: {
    "40-50": { total: 0, correct: 0, accuracy: 0 },
    "50-60": { total: 0, correct: 0, accuracy: 0 },
    "60-70": { total: 0, correct: 0, accuracy: 0 },
    "70-80": { total: 0, correct: 0, accuracy: 0 },
    "80-90": { total: 0, correct: 0, accuracy: 0 },
  },
  matchTypeStats: {
    home_favorite: { total: 0, correct: 0, accuracy: 0 },
    away_favorite: { total: 0, correct: 0, accuracy: 0 },
    even: { total: 0, correct: 0, accuracy: 0 },
    underdog_pick: { total: 0, correct: 0, accuracy: 0 },
  },
  lastUpdated: new Date().toISOString(),
  totalResults: 0,
};

// ============= FILE OPERATIONS =============

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadJSON<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as T;
    }
  } catch (error) {
    console.error(`[MODEL] Error loading ${filePath}:`, error);
  }
  return defaultValue;
}

function saveJSON<T>(filePath: string, data: T): boolean {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`[MODEL] Error saving ${filePath}:`, error);
    return false;
  }
}

// ============= CALIBRATION PERSISTENCE =============

export function loadCalibration(): CalibrationData {
  const data = loadJSON<CalibrationData>(CALIBRATION_FILE, DEFAULT_CALIBRATION);
  console.log(`[MODEL] Loaded calibration data (${data.totalResults} results tracked)`);
  return data;
}

export function saveCalibration(calibration: CalibrationData): boolean {
  calibration.lastUpdated = new Date().toISOString();
  const success = saveJSON(CALIBRATION_FILE, calibration);
  if (success) {
    console.log(`[MODEL] Calibration saved (${calibration.totalResults} results)`);
  }
  return success;
}

// ============= PREDICTION HISTORY =============

export function loadPredictionHistory(): HistoricalPrediction[] {
  return loadJSON<HistoricalPrediction[]>(HISTORY_FILE, []);
}

export function savePredictionHistory(predictions: HistoricalPrediction[]): boolean {
  // Keep only last 500 predictions
  const trimmed = predictions.slice(-500);
  return saveJSON(HISTORY_FILE, trimmed);
}

export function addPredictionToHistory(prediction: HistoricalPrediction): void {
  const history = loadPredictionHistory();
  history.push(prediction);
  savePredictionHistory(history);
}

export function recordResultInHistory(
  matchIdentifier: string,
  actual: "Home" | "Away" | "Draw"
): HistoricalPrediction | null {
  const history = loadPredictionHistory();
  
  const prediction = history.find(p => 
    !p.actual && (
      p.id.includes(matchIdentifier) ||
      p.match.toLowerCase().includes(matchIdentifier.toLowerCase()) ||
      p.homeTeam.toLowerCase().includes(matchIdentifier.toLowerCase()) ||
      p.awayTeam.toLowerCase().includes(matchIdentifier.toLowerCase())
    )
  );
  
  if (prediction) {
    prediction.actual = actual;
    prediction.correct = prediction.predicted === actual;
    savePredictionHistory(history);
    
    // Update calibration stats
    updateCalibrationFromResult(prediction);
    
    console.log(`[MODEL] Result recorded: ${prediction.match} → ${actual} ${prediction.correct ? "✓" : "✗"}`);
    return prediction;
  }
  
  return null;
}

// ============= CALIBRATION UPDATES =============

function getConfidenceBucket(confidence: number): string {
  if (confidence < 50) return "40-50";
  if (confidence < 60) return "50-60";
  if (confidence < 70) return "60-70";
  if (confidence < 80) return "70-80";
  return "80-90";
}

export function updateCalibrationFromResult(prediction: HistoricalPrediction): void {
  if (!prediction.actual || prediction.correct === undefined) return;
  
  const calibration = loadCalibration();
  const bucket = getConfidenceBucket(prediction.rawConfidence || prediction.confidence);
  
  // Update bucket stats
  if (!calibration.bucketStats[bucket]) {
    calibration.bucketStats[bucket] = { total: 0, correct: 0, accuracy: 0 };
  }
  calibration.bucketStats[bucket].total++;
  if (prediction.correct) {
    calibration.bucketStats[bucket].correct++;
  }
  calibration.bucketStats[bucket].accuracy = Math.round(
    (calibration.bucketStats[bucket].correct / calibration.bucketStats[bucket].total) * 100
  );
  
  // Update match type stats
  if (prediction.matchType && calibration.matchTypeStats[prediction.matchType]) {
    calibration.matchTypeStats[prediction.matchType].total++;
    if (prediction.correct) {
      calibration.matchTypeStats[prediction.matchType].correct++;
    }
    calibration.matchTypeStats[prediction.matchType].accuracy = Math.round(
      (calibration.matchTypeStats[prediction.matchType].correct / 
       calibration.matchTypeStats[prediction.matchType].total) * 100
    );
  }
  
  calibration.totalResults++;
  
  // Recalculate calibration factors every 10 results
  if (calibration.totalResults % 10 === 0) {
    recalculateCalibrationFactors(calibration);
  }
  
  saveCalibration(calibration);
}

function recalculateCalibrationFactors(calibration: CalibrationData): void {
  const expectedAccuracy: Record<string, number> = {
    "40-50": 45,
    "50-60": 55,
    "60-70": 65,
    "70-80": 75,
    "80-90": 85,
  };
  
  Object.keys(calibration.factors).forEach((bucket) => {
    const stats = calibration.bucketStats[bucket];
    if (stats && stats.total >= 5) {
      // If we predict 70% but only hit 60%, we should reduce confidence by ~10%
      const error = stats.accuracy - expectedAccuracy[bucket];
      // Use 50% of error as adjustment to avoid over-correction
      calibration.factors[bucket as keyof typeof calibration.factors] = Math.round(error * 0.5);
    }
  });
  
  console.log("[MODEL] Calibration factors updated:", calibration.factors);
}

// ============= APPLY CALIBRATION =============

export function applyCalibration(confidence: number): number {
  const calibration = loadCalibration();
  const bucket = getConfidenceBucket(confidence);
  const adjustment = calibration.factors[bucket as keyof typeof calibration.factors] || 0;
  return Math.max(35, Math.min(95, Math.round(confidence + adjustment)));
}

// ============= ACCURACY INSIGHTS =============

export function getAccuracyInsights(): {
  overall: number;
  byBucket: Record<string, number>;
  byMatchType: Record<string, number>;
  trend: "improving" | "stable" | "declining";
  recommendations: string[];
} {
  const calibration = loadCalibration();
  const history = loadPredictionHistory();
  
  const completed = history.filter(p => p.actual);
  const correct = completed.filter(p => p.correct);
  const overall = completed.length > 0 ? Math.round((correct.length / completed.length) * 100) : 0;
  
  // Calculate trend from last 20 vs previous 20
  const recent20 = completed.slice(-20);
  const prev20 = completed.slice(-40, -20);
  const recentAccuracy = recent20.length > 0 
    ? (recent20.filter(p => p.correct).length / recent20.length) * 100 
    : 0;
  const prevAccuracy = prev20.length > 0
    ? (prev20.filter(p => p.correct).length / prev20.length) * 100
    : recentAccuracy;
  
  let trend: "improving" | "stable" | "declining" = "stable";
  if (recentAccuracy > prevAccuracy + 5) trend = "improving";
  else if (recentAccuracy < prevAccuracy - 5) trend = "declining";
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  Object.entries(calibration.bucketStats).forEach(([bucket, stats]) => {
    if (stats.total >= 5) {
      const expected = parseInt(bucket.split("-")[0]) + 5;
      if (stats.accuracy < expected - 10) {
        recommendations.push(`${bucket}% confidence predictions are overconfident (${stats.accuracy}% actual)`);
      } else if (stats.accuracy > expected + 10) {
        recommendations.push(`${bucket}% confidence predictions are underconfident (${stats.accuracy}% actual)`);
      }
    }
  });
  
  if (calibration.matchTypeStats.underdog_pick?.total >= 5 && 
      calibration.matchTypeStats.underdog_pick.accuracy < 40) {
    recommendations.push("Underdog picks are underperforming - consider reducing confidence for these");
  }
  
  if (completed.length < 50) {
    recommendations.push("Need more tracked results for reliable calibration (currently: " + completed.length + ")");
  }
  
  return {
    overall,
    byBucket: Object.fromEntries(
      Object.entries(calibration.bucketStats).map(([k, v]) => [k, v.accuracy])
    ),
    byMatchType: Object.fromEntries(
      Object.entries(calibration.matchTypeStats).map(([k, v]) => [k, v.accuracy])
    ),
    trend,
    recommendations,
  };
}

// ============= SYNC WITH USER FEATURES =============

/**
 * Import results from user features localStorage data
 * Call this to sync user-tracked results into model calibration
 */
export function syncFromUserResults(userPredictions: Array<{
  matchId: string;
  matchName: string;
  homeTeam: string;
  awayTeam: string;
  predictedWinner: "Home" | "Away" | "Draw";
  confidence: number;
  actualResult?: "Home" | "Away" | "Draw";
  wasCorrect?: boolean;
}>): { synced: number; skipped: number } {
  const history = loadPredictionHistory();
  let synced = 0;
  let skipped = 0;
  
  for (const pred of userPredictions) {
    // Check if already in history
    const exists = history.some(h => h.id === pred.matchId || h.match === pred.matchName);
    
    if (!exists && pred.actualResult) {
      // Add to history with result
      const newPred: HistoricalPrediction = {
        id: pred.matchId,
        match: pred.matchName,
        homeTeam: pred.homeTeam,
        awayTeam: pred.awayTeam,
        predicted: pred.predictedWinner,
        confidence: pred.confidence,
        actual: pred.actualResult,
        correct: pred.wasCorrect,
        timestamp: new Date().toISOString(),
      };
      
      history.push(newPred);
      updateCalibrationFromResult(newPred);
      synced++;
    } else {
      skipped++;
    }
  }
  
  if (synced > 0) {
    savePredictionHistory(history);
    console.log(`[MODEL] Synced ${synced} results from user data`);
  }
  
  return { synced, skipped };
}

// ============= REBUILD / RECOMPUTE CALIBRATION =============

/**
 * Rebuild calibration entirely from recorded prediction history.
 * Useful when calibration file is missing or needs to be recomputed.
 */
export function rebuildCalibrationFromHistory(): CalibrationData {
  const history = loadPredictionHistory();

  // Start from defaults
  const calibration: CalibrationData = JSON.parse(JSON.stringify(DEFAULT_CALIBRATION));

  // Reset bucket and match type stats
  calibration.bucketStats = {} as any;
  Object.keys(DEFAULT_CALIBRATION.bucketStats).forEach(k => {
    calibration.bucketStats[k] = { total: 0, correct: 0, accuracy: 0 };
  });

  calibration.matchTypeStats = {} as any;
  Object.keys(DEFAULT_CALIBRATION.matchTypeStats).forEach(k => {
    calibration.matchTypeStats[k] = { total: 0, correct: 0, accuracy: 0 };
  });

  let counted = 0;

  for (const p of history) {
    if (!p.actual) continue;
    counted++;

    const bucket = getConfidenceBucket(p.rawConfidence || p.confidence);
    if (!calibration.bucketStats[bucket]) {
      calibration.bucketStats[bucket] = { total: 0, correct: 0, accuracy: 0 };
    }
    calibration.bucketStats[bucket].total++;
    if (p.correct) calibration.bucketStats[bucket].correct++;

    if (p.matchType) {
      if (!calibration.matchTypeStats[p.matchType]) {
        calibration.matchTypeStats[p.matchType] = { total: 0, correct: 0, accuracy: 0 };
      }
      calibration.matchTypeStats[p.matchType].total++;
      if (p.correct) calibration.matchTypeStats[p.matchType].correct++;
    }
  }

  // Compute accuracies
  Object.entries(calibration.bucketStats).forEach(([k, v]: any) => {
    v.accuracy = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
  });

  Object.entries(calibration.matchTypeStats).forEach(([k, v]: any) => {
    v.accuracy = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
  });

  calibration.totalResults = counted;
  calibration.lastUpdated = new Date().toISOString();

  // Recalculate factors using same logic
  const expectedAccuracy: Record<string, number> = {
    "40-50": 45,
    "50-60": 55,
    "60-70": 65,
    "70-80": 75,
    "80-90": 85,
  };

  Object.keys(calibration.factors).forEach((bucket) => {
    const stats = calibration.bucketStats[bucket];
    if (stats && stats.total >= 5) {
      const error = stats.accuracy - expectedAccuracy[bucket];
      calibration.factors[bucket as keyof typeof calibration.factors] = Math.round(error * 0.5);
    } else {
      calibration.factors[bucket as keyof typeof calibration.factors] = 0;
    }
  });

  saveCalibration(calibration);

  console.log('[MODEL] Rebuilt calibration from history:', calibration);
  return calibration;
}
