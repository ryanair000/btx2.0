/**
 * User Features Service
 * 
 * Provides local storage-based features for user engagement:
 * - Save/bookmark predictions
 * - Track prediction history with outcomes
 * - Calculate accuracy statistics
 * - Share predictions
 * 
 * Uses localStorage for persistence (works offline, no auth required)
 */

// ============= INTERFACES =============

export interface StoredPrediction {
  id: string;
  matchId: string;
  matchName: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  predictedWinner: "Home" | "Away" | "Draw";
  confidence: number;
  predictedAccuracy: number;
  summaryInsight: string;
  keyFactors: string[];
  // Betting markets summary
  expectedHomeGoals?: number;
  expectedAwayGoals?: number;
  overUnder25?: "OVER" | "UNDER" | "SKIP";
  btts?: "YES" | "NO" | "SKIP";
  bestBets?: string[];
  // Outcome tracking
  actualResult?: "Home" | "Away" | "Draw" | null;
  actualHomeGoals?: number;
  actualAwayGoals?: number;
  wasCorrect?: boolean;
  // Metadata
  createdAt: string;
  isFavorite: boolean;
  method: string;  // "standard", "conservative", "aggressive"
}

export interface PredictionStats {
  totalPredictions: number;
  correctPredictions: number;
  incorrectPredictions: number;
  pendingResults: number;
  accuracy: number;
  homeWinAccuracy: number;
  awayWinAccuracy: number;
  drawAccuracy: number;
  averageConfidence: number;
  avgConfidenceWhenCorrect: number;
  avgConfidenceWhenWrong: number;
  last10Accuracy: number;
  byMethod: Record<string, { total: number; correct: number; accuracy: number }>;
  streak: { type: "win" | "loss" | "none"; count: number };
}

export interface ShareableContent {
  text: string;
  url: string;
}

// ============= STORAGE KEYS =============

const STORAGE_KEYS = {
  PREDICTIONS: "btx_predictions",
  FAVORITES: "btx_favorites",
  SETTINGS: "btx_user_settings",
};

// ============= HELPER FUNCTIONS =============

function generateId(): string {
  return `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
}

// ============= PREDICTION STORAGE =============

/**
 * Check if a similar prediction already exists
 * Returns the existing prediction if found (same match + winner + within 1% confidence)
 */
export function findDuplicatePrediction(
  matchId: string,
  predictedWinner: "Home" | "Away" | "Draw",
  confidence: number
): StoredPrediction | null {
  const predictions = getAllPredictions();
  
  return predictions.find(p => 
    p.matchId === matchId &&
    p.predictedWinner === predictedWinner &&
    Math.abs(p.confidence - confidence) <= 1
  ) || null;
}

/**
 * Check if prediction for this match exists (any prediction)
 */
export function hasExistingPrediction(matchId: string): boolean {
  const predictions = getAllPredictions();
  return predictions.some(p => p.matchId === matchId);
}

/**
 * Get all predictions for a specific match
 */
export function getPredictionsForMatch(matchId: string): StoredPrediction[] {
  const predictions = getAllPredictions();
  return predictions.filter(p => p.matchId === matchId);
}

/**
 * Save a new prediction to history (with duplicate check option)
 */
export function savePrediction(
  prediction: Omit<StoredPrediction, "id" | "createdAt">,
  skipDuplicateCheck: boolean = false
): StoredPrediction | null {
  // Check for duplicates unless skipped
  if (!skipDuplicateCheck) {
    const existing = findDuplicatePrediction(
      prediction.matchId,
      prediction.predictedWinner,
      prediction.confidence
    );
    
    if (existing) {
      console.log(`[History] Duplicate prediction exists for ${prediction.matchName}`);
      return null;  // Return null to indicate no new save
    }
  }
  
  const predictions = getStorage<StoredPrediction[]>(STORAGE_KEYS.PREDICTIONS, []);
  
  const newPrediction: StoredPrediction = {
    ...prediction,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  
  // Add to beginning of array (most recent first)
  predictions.unshift(newPrediction);
  
  // Keep only last 200 predictions
  const trimmedPredictions = predictions.slice(0, 200);
  
  setStorage(STORAGE_KEYS.PREDICTIONS, trimmedPredictions);
  
  console.log(`[History] Saved prediction: ${prediction.matchName}`);
  
  return newPrediction;
}

/**
 * Get all stored predictions
 */
export function getAllPredictions(): StoredPrediction[] {
  return getStorage<StoredPrediction[]>(STORAGE_KEYS.PREDICTIONS, []);
}

/**
 * Get predictions filtered by criteria
 */
export function getPredictions(options?: {
  limit?: number;
  favoritesOnly?: boolean;
  pendingOnly?: boolean;
  completedOnly?: boolean;
  method?: string;
}): StoredPrediction[] {
  let predictions = getAllPredictions();
  
  if (options?.favoritesOnly) {
    predictions = predictions.filter(p => p.isFavorite);
  }
  
  if (options?.pendingOnly) {
    predictions = predictions.filter(p => p.actualResult === undefined);
  }
  
  if (options?.completedOnly) {
    predictions = predictions.filter(p => p.actualResult !== undefined);
  }
  
  if (options?.method) {
    predictions = predictions.filter(p => p.method === options.method);
  }
  
  if (options?.limit) {
    predictions = predictions.slice(0, options.limit);
  }
  
  return predictions;
}

/**
 * Get prediction by ID
 */
export function getPredictionById(id: string): StoredPrediction | null {
  const predictions = getAllPredictions();
  return predictions.find(p => p.id === id) || null;
}

/**
 * Delete a prediction
 */
export function deletePrediction(id: string): boolean {
  const predictions = getAllPredictions();
  const filtered = predictions.filter(p => p.id !== id);
  
  if (filtered.length === predictions.length) {
    return false; // Not found
  }
  
  setStorage(STORAGE_KEYS.PREDICTIONS, filtered);
  return true;
}

/**
 * Toggle favorite status
 */
export function toggleFavorite(id: string): boolean {
  const predictions = getAllPredictions();
  const prediction = predictions.find(p => p.id === id);
  
  if (!prediction) return false;
  
  prediction.isFavorite = !prediction.isFavorite;
  setStorage(STORAGE_KEYS.PREDICTIONS, predictions);
  
  return prediction.isFavorite;
}

// ============= OUTCOME TRACKING =============

/**
 * Record the actual match result
 */
export function recordActualResult(
  id: string,
  actualResult: "Home" | "Away" | "Draw",
  homeGoals: number,
  awayGoals: number
): StoredPrediction | null {
  const predictions = getAllPredictions();
  const prediction = predictions.find(p => p.id === id);
  
  if (!prediction) return null;
  
  prediction.actualResult = actualResult;
  prediction.actualHomeGoals = homeGoals;
  prediction.actualAwayGoals = awayGoals;
  prediction.wasCorrect = prediction.predictedWinner === actualResult;
  
  setStorage(STORAGE_KEYS.PREDICTIONS, predictions);
  
  console.log(`[History] Result recorded for ${prediction.matchName}: ${actualResult} (${prediction.wasCorrect ? "✓" : "✗"})`);
  
  return prediction;
}

/**
 * Bulk update results from match data
 */
export function updateResultsFromMatches(
  matchResults: Array<{
    matchId: string;
    homeGoals: number;
    awayGoals: number;
  }>
): number {
  const predictions = getAllPredictions();
  let updatedCount = 0;
  
  for (const result of matchResults) {
    const prediction = predictions.find(p => p.matchId === result.matchId && !p.actualResult);
    
    if (prediction) {
      let actualResult: "Home" | "Away" | "Draw";
      if (result.homeGoals > result.awayGoals) actualResult = "Home";
      else if (result.homeGoals < result.awayGoals) actualResult = "Away";
      else actualResult = "Draw";
      
      prediction.actualResult = actualResult;
      prediction.actualHomeGoals = result.homeGoals;
      prediction.actualAwayGoals = result.awayGoals;
      prediction.wasCorrect = prediction.predictedWinner === actualResult;
      
      updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    setStorage(STORAGE_KEYS.PREDICTIONS, predictions);
    console.log(`[History] Updated ${updatedCount} match results`);
  }
  
  return updatedCount;
}

// ============= STATISTICS =============

/**
 * Calculate prediction accuracy statistics
 */
export function calculateStats(): PredictionStats {
  const predictions = getAllPredictions();
  
  const completed = predictions.filter(p => p.actualResult !== undefined);
  const correct = completed.filter(p => p.wasCorrect);
  const incorrect = completed.filter(p => !p.wasCorrect);
  const pending = predictions.filter(p => p.actualResult === undefined);
  
  // By outcome type
  const homeWinPredictions = completed.filter(p => p.predictedWinner === "Home");
  const awayWinPredictions = completed.filter(p => p.predictedWinner === "Away");
  const drawPredictions = completed.filter(p => p.predictedWinner === "Draw");
  
  const homeCorrect = homeWinPredictions.filter(p => p.wasCorrect).length;
  const awayCorrect = awayWinPredictions.filter(p => p.wasCorrect).length;
  const drawCorrect = drawPredictions.filter(p => p.wasCorrect).length;
  
  // Confidence analysis
  const avgConfidence = predictions.length > 0
    ? predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
    : 0;
  
  const avgConfidenceWhenCorrect = correct.length > 0
    ? correct.reduce((sum, p) => sum + p.confidence, 0) / correct.length
    : 0;
  
  const avgConfidenceWhenWrong = incorrect.length > 0
    ? incorrect.reduce((sum, p) => sum + p.confidence, 0) / incorrect.length
    : 0;
  
  // Last 10 accuracy
  const last10Completed = completed.slice(0, 10);
  const last10Correct = last10Completed.filter(p => p.wasCorrect).length;
  
  // By method
  const methods = [...new Set(predictions.map(p => p.method))];
  const byMethod: Record<string, { total: number; correct: number; accuracy: number }> = {};
  
  for (const method of methods) {
    const methodPredictions = completed.filter(p => p.method === method);
    const methodCorrect = methodPredictions.filter(p => p.wasCorrect).length;
    byMethod[method] = {
      total: methodPredictions.length,
      correct: methodCorrect,
      accuracy: methodPredictions.length > 0 ? (methodCorrect / methodPredictions.length) * 100 : 0,
    };
  }
  
  // Calculate streak
  let streak: { type: "win" | "loss" | "none"; count: number } = { type: "none", count: 0 };
  if (completed.length > 0) {
    const firstResult = completed[0].wasCorrect;
    let count = 0;
    for (const p of completed) {
      if (p.wasCorrect === firstResult) count++;
      else break;
    }
    streak = { type: firstResult ? "win" : "loss", count };
  }
  
  return {
    totalPredictions: predictions.length,
    correctPredictions: correct.length,
    incorrectPredictions: incorrect.length,
    pendingResults: pending.length,
    accuracy: completed.length > 0 ? (correct.length / completed.length) * 100 : 0,
    homeWinAccuracy: homeWinPredictions.length > 0 ? (homeCorrect / homeWinPredictions.length) * 100 : 0,
    awayWinAccuracy: awayWinPredictions.length > 0 ? (awayCorrect / awayWinPredictions.length) * 100 : 0,
    drawAccuracy: drawPredictions.length > 0 ? (drawCorrect / drawPredictions.length) * 100 : 0,
    averageConfidence: avgConfidence,
    avgConfidenceWhenCorrect,
    avgConfidenceWhenWrong,
    last10Accuracy: last10Completed.length > 0 ? (last10Correct / last10Completed.length) * 100 : 0,
    byMethod,
    streak,
  };
}

// ============= SHARE FEATURE =============

/**
 * Generate shareable content for a prediction
 */
export function generateShareContent(prediction: StoredPrediction): ShareableContent {
  const winnerText = 
    prediction.predictedWinner === "Home" ? prediction.homeTeam :
    prediction.predictedWinner === "Away" ? prediction.awayTeam :
    "Draw";
  
  let text = `🎯 BTX Prediction: ${prediction.matchName}\n\n`;
  text += `📊 Prediction: ${winnerText} (${prediction.confidence}% confidence)\n`;
  
  if (prediction.expectedHomeGoals !== undefined && prediction.expectedAwayGoals !== undefined) {
    text += `⚽ Expected: ${prediction.expectedHomeGoals.toFixed(1)} - ${prediction.expectedAwayGoals.toFixed(1)}\n`;
  }
  
  if (prediction.overUnder25) {
    text += `📈 O/U 2.5: ${prediction.overUnder25}\n`;
  }
  
  if (prediction.btts) {
    text += `🥅 BTTS: ${prediction.btts}\n`;
  }
  
  if (prediction.bestBets && prediction.bestBets.length > 0) {
    text += `\n💡 Best Bets: ${prediction.bestBets.join(", ")}\n`;
  }
  
  text += `\n📝 ${prediction.summaryInsight}`;
  
  // If we have actual result
  if (prediction.actualResult) {
    text += `\n\n${prediction.wasCorrect ? "✅" : "❌"} Result: ${prediction.actualHomeGoals}-${prediction.actualAwayGoals}`;
  }
  
  return {
    text,
    url: typeof window !== "undefined" ? window.location.href : "",
  };
}

/**
 * Copy prediction to clipboard
 */
export async function copyPredictionToClipboard(prediction: StoredPrediction): Promise<boolean> {
  const { text } = generateShareContent(prediction);
  
  try {
    // Check if clipboard API is available
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      // Fallback: create temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
    
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    
    // Fallback method if clipboard API fails
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (fallbackError) {
      console.error("Fallback copy also failed:", fallbackError);
      return false;
    }
  }
}

/**
 * Share prediction via Web Share API (mobile)
 */
export async function sharePrediction(prediction: StoredPrediction): Promise<boolean> {
  const { text, url } = generateShareContent(prediction);
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: `BTX Prediction: ${prediction.matchName}`,
        text,
        url,
      });
      return true;
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Failed to share:", error);
      }
      return false;
    }
  } else {
    // Fallback to clipboard
    return copyPredictionToClipboard(prediction);
  }
}

// ============= EXPORT/IMPORT =============

/**
 * Export all predictions as JSON
 */
export function exportPredictions(): string {
  const predictions = getAllPredictions();
  const stats = calculateStats();
  
  return JSON.stringify({
    exportDate: new Date().toISOString(),
    stats,
    predictions,
  }, null, 2);
}

/**
 * Import predictions from JSON
 */
export function importPredictions(jsonString: string): { success: boolean; count: number; error?: string } {
  try {
    const data = JSON.parse(jsonString);
    
    if (!data.predictions || !Array.isArray(data.predictions)) {
      return { success: false, count: 0, error: "Invalid format" };
    }
    
    const existingPredictions = getAllPredictions();
    const existingIds = new Set(existingPredictions.map(p => p.id));
    
    // Filter out duplicates
    const newPredictions = data.predictions.filter((p: StoredPrediction) => !existingIds.has(p.id));
    
    // Merge and save
    const merged = [...newPredictions, ...existingPredictions];
    setStorage(STORAGE_KEYS.PREDICTIONS, merged);
    
    return { success: true, count: newPredictions.length };
  } catch (error) {
    return { success: false, count: 0, error: (error as Error).message };
  }
}

// ============= CLEAR DATA =============

/**
 * Clear all prediction history
 */
export function clearAllPredictions(): void {
  setStorage(STORAGE_KEYS.PREDICTIONS, []);
  console.log("[History] Cleared all predictions");
}
