/**
 * Betting Markets Prediction Service
 * 
 * Provides predictions for key betting markets:
 * 1. Over/Under Goals (0.5, 1.5, 2.5, 3.5)
 * 2. Both Teams To Score (BTTS)
 * 3. Asian Handicap
 * 4. Double Chance (1X, X2, 12)
 * 5. Goal Distributions for Correct Score
 * 
 * Uses historical data + team stats to generate probability-based predictions
 */

import fs from "fs";
import path from "path";

// ============= INTERFACES =============

export interface OverUnderPrediction {
  line: number;  // 0.5, 1.5, 2.5, 3.5
  overProbability: number;
  underProbability: number;
  recommendation: "OVER" | "UNDER" | "SKIP";
  confidence: number;
  expectedGoals: number;
  insight: string;
}

export interface BTTSPrediction {
  yesProbability: number;
  noProbability: number;
  recommendation: "YES" | "NO" | "SKIP";
  confidence: number;
  homeCleanSheetProb: number;
  awayCleanSheetProb: number;
  insight: string;
}

export interface AsianHandicapPrediction {
  line: number;  // -0.5, -1, -1.5, +0.5, +1, etc.
  team: "HOME" | "AWAY";
  coverProbability: number;
  recommendation: "BACK" | "SKIP";
  confidence: number;
  expectedMargin: number;
  insight: string;
}

export interface DoubleChancePrediction {
  outcome: "1X" | "X2" | "12";
  probability: number;
  recommendation: "BACK" | "SKIP";
  confidence: number;
  insight: string;
}

export interface GoalDistribution {
  goals: number;
  probability: number;
}

export interface CorrectScorePrediction {
  homeGoals: number;
  awayGoals: number;
  probability: number;
}

export interface BettingMarketsPrediction {
  homeTeam: string;
  awayTeam: string;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  expectedTotalGoals: number;
  overUnder: OverUnderPrediction[];
  btts: BTTSPrediction;
  asianHandicap: AsianHandicapPrediction[];
  doubleChance: DoubleChancePrediction[];
  topCorrectScores: CorrectScorePrediction[];
  homeGoalDistribution: GoalDistribution[];
  awayGoalDistribution: GoalDistribution[];
  bestBets: string[];
}

// ============= DATA LOADING =============

interface MatchData {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  totalGoals: number;
  btts: boolean;
  season: string;
}

let cachedMatches: MatchData[] | null = null;

function loadMatchData(): MatchData[] {
  if (cachedMatches) return cachedMatches;
  
  const dataDir = path.join(process.cwd(), "data");
  const seasons = ["2425", "2324", "2223", "2122", "2021"];
  const matches: MatchData[] = [];
  
  for (const season of seasons) {
    const csvPath = path.join(dataDir, `epl_${season}.csv`);
    
    if (!fs.existsSync(csvPath)) continue;
    
    const content = fs.readFileSync(csvPath, "utf-8");
    const lines = content.split("\n");
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const fields = line.split(",");
      if (fields.length < 10) continue;
      
      const homeGoals = parseInt(fields[5]) || 0;
      const awayGoals = parseInt(fields[6]) || 0;
      
      matches.push({
        homeTeam: fields[3],
        awayTeam: fields[4],
        homeGoals,
        awayGoals,
        totalGoals: homeGoals + awayGoals,
        btts: homeGoals > 0 && awayGoals > 0,
        season: `20${season.slice(0, 2)}-${season.slice(2)}`,
      });
    }
  }
  
  console.log(`[Betting] Loaded ${matches.length} matches for market analysis`);
  cachedMatches = matches;
  return matches;
}

// ============= TEAM STATISTICS =============

interface TeamGoalStats {
  team: string;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  avgTotalGoals: number;
  cleanSheetRate: number;
  failedToScoreRate: number;
  bttsRate: number;
  over25Rate: number;
  over15Rate: number;
  over35Rate: number;
  homeAvgScored: number;
  homeAvgConceded: number;
  awayAvgScored: number;
  awayAvgConceded: number;
  gamesPlayed: number;
}

function isTeamMatch(dataTeam: string, searchTeam: string): boolean {
  const dataLower = dataTeam.toLowerCase();
  const searchLower = searchTeam.toLowerCase().replace(" fc", "").replace(" afc", "");
  
  if (dataLower === searchLower) return true;
  if (dataLower.includes(searchLower)) return true;
  if (searchLower.includes(dataLower)) return true;
  
  // Common mappings
  const mappings: Record<string, string[]> = {
    "man united": ["manchester united"],
    "man city": ["manchester city"],
    "nott'm forest": ["nottingham forest"],
    "wolves": ["wolverhampton"],
    "spurs": ["tottenham"],
  };
  
  for (const [short, fulls] of Object.entries(mappings)) {
    if (dataLower.includes(short) || fulls.some(f => dataLower.includes(f))) {
      if (searchLower.includes(short) || fulls.some(f => searchLower.includes(f))) {
        return true;
      }
    }
  }
  
  return false;
}

function getTeamGoalStats(teamName: string, season?: string): TeamGoalStats | null {
  const matches = loadMatchData();
  const targetSeason = season || "2024-25";
  
  const homeMatches = matches.filter(m => 
    m.season === targetSeason && isTeamMatch(m.homeTeam, teamName)
  );
  const awayMatches = matches.filter(m => 
    m.season === targetSeason && isTeamMatch(m.awayTeam, teamName)
  );
  
  const allMatches = [...homeMatches, ...awayMatches];
  
  if (allMatches.length < 3) {
    // Not enough current season data, use all seasons
    const allHomeMatches = matches.filter(m => isTeamMatch(m.homeTeam, teamName));
    const allAwayMatches = matches.filter(m => isTeamMatch(m.awayTeam, teamName));
    
    if (allHomeMatches.length + allAwayMatches.length < 5) {
      return null;
    }
    
    return calculateStats(teamName, allHomeMatches, allAwayMatches);
  }
  
  return calculateStats(teamName, homeMatches, awayMatches);
}

function calculateStats(
  teamName: string,
  homeMatches: MatchData[],
  awayMatches: MatchData[]
): TeamGoalStats {
  const allMatches = [...homeMatches, ...awayMatches];
  const total = allMatches.length;
  
  // Home stats
  const homeScored = homeMatches.reduce((sum, m) => sum + m.homeGoals, 0);
  const homeConceded = homeMatches.reduce((sum, m) => sum + m.awayGoals, 0);
  
  // Away stats
  const awayScored = awayMatches.reduce((sum, m) => sum + m.awayGoals, 0);
  const awayConceded = awayMatches.reduce((sum, m) => sum + m.homeGoals, 0);
  
  // Combined
  const totalScored = homeScored + awayScored;
  const totalConceded = homeConceded + awayConceded;
  
  // Rates
  const cleanSheets = homeMatches.filter(m => m.awayGoals === 0).length +
                      awayMatches.filter(m => m.homeGoals === 0).length;
  const failedToScore = homeMatches.filter(m => m.homeGoals === 0).length +
                        awayMatches.filter(m => m.awayGoals === 0).length;
  const bttsCount = allMatches.filter(m => m.btts).length;
  const over25 = allMatches.filter(m => m.totalGoals > 2.5).length;
  const over15 = allMatches.filter(m => m.totalGoals > 1.5).length;
  const over35 = allMatches.filter(m => m.totalGoals > 3.5).length;
  
  return {
    team: teamName,
    avgGoalsScored: totalScored / total,
    avgGoalsConceded: totalConceded / total,
    avgTotalGoals: (totalScored + totalConceded) / total,
    cleanSheetRate: cleanSheets / total,
    failedToScoreRate: failedToScore / total,
    bttsRate: bttsCount / total,
    over25Rate: over25 / total,
    over15Rate: over15 / total,
    over35Rate: over35 / total,
    homeAvgScored: homeMatches.length > 0 ? homeScored / homeMatches.length : 0,
    homeAvgConceded: homeMatches.length > 0 ? homeConceded / homeMatches.length : 0,
    awayAvgScored: awayMatches.length > 0 ? awayScored / awayMatches.length : 0,
    awayAvgConceded: awayMatches.length > 0 ? awayConceded / awayMatches.length : 0,
    gamesPlayed: total,
  };
}

// ============= POISSON DISTRIBUTION =============

function poisson(lambda: number, k: number): number {
  // P(X = k) = (lambda^k * e^-lambda) / k!
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

function poissonCumulative(lambda: number, maxK: number): number {
  let sum = 0;
  for (let k = 0; k <= maxK; k++) {
    sum += poisson(lambda, k);
  }
  return sum;
}

// ============= OVER/UNDER PREDICTION =============

function predictOverUnder(
  homeStats: TeamGoalStats,
  awayStats: TeamGoalStats,
  isHome: boolean
): OverUnderPrediction[] {
  // Calculate expected goals using attacking/defensive ratings
  const homeExpected = (homeStats.homeAvgScored + awayStats.awayAvgConceded) / 2;
  const awayExpected = (awayStats.awayAvgScored + homeStats.homeAvgConceded) / 2;
  const totalExpected = homeExpected + awayExpected;
  
  // Use Poisson to calculate exact goal probabilities
  const maxGoals = 8;
  const totalProbs: number[] = [];
  
  for (let total = 0; total <= maxGoals; total++) {
    let prob = 0;
    for (let home = 0; home <= total; home++) {
      const away = total - home;
      prob += poisson(homeExpected, home) * poisson(awayExpected, away);
    }
    totalProbs.push(prob);
  }
  
  // Calculate Over/Under for each line
  const lines = [0.5, 1.5, 2.5, 3.5];
  const predictions: OverUnderPrediction[] = [];
  
  for (const line of lines) {
    const underProb = totalProbs.slice(0, Math.floor(line) + 1).reduce((a, b) => a + b, 0);
    const overProb = 1 - underProb;
    
    // Recommendation
    let recommendation: "OVER" | "UNDER" | "SKIP" = "SKIP";
    let confidence = 0;
    
    if (overProb > 0.60) {
      recommendation = "OVER";
      confidence = Math.round(overProb * 100);
    } else if (underProb > 0.60) {
      recommendation = "UNDER";
      confidence = Math.round(underProb * 100);
    } else {
      confidence = Math.round(Math.max(overProb, underProb) * 100);
    }
    
    // Insight
    let insight = "";
    if (line === 2.5) {
      const avgOver25 = (homeStats.over25Rate + awayStats.over25Rate) / 2;
      insight = `Historical O2.5 rate: ${Math.round(avgOver25 * 100)}%`;
    } else if (line === 1.5) {
      insight = `Expected total: ${totalExpected.toFixed(1)} goals`;
    } else if (line === 3.5) {
      const avgOver35 = (homeStats.over35Rate + awayStats.over35Rate) / 2;
      insight = `O3.5 rate: ${Math.round(avgOver35 * 100)}%, high-scoring potential`;
    } else {
      insight = `Very likely ${overProb > 0.5 ? "at least 1 goal" : "goalless draw risk"}`;
    }
    
    predictions.push({
      line,
      overProbability: Math.round(overProb * 100),
      underProbability: Math.round(underProb * 100),
      recommendation,
      confidence,
      expectedGoals: totalExpected,
      insight,
    });
  }
  
  return predictions;
}

// ============= BTTS PREDICTION =============

function predictBTTS(
  homeStats: TeamGoalStats,
  awayStats: TeamGoalStats
): BTTSPrediction {
  // Calculate scoring probabilities
  const homeExpected = (homeStats.homeAvgScored + awayStats.awayAvgConceded) / 2;
  const awayExpected = (awayStats.awayAvgScored + homeStats.homeAvgConceded) / 2;
  
  // P(home scores) = 1 - P(home = 0)
  const homeScoresProb = 1 - poisson(homeExpected, 0);
  const awayScoresProb = 1 - poisson(awayExpected, 0);
  
  // P(BTTS) = P(home scores) * P(away scores)
  const bttsYesProb = homeScoresProb * awayScoresProb;
  const bttsNoProb = 1 - bttsYesProb;
  
  // Clean sheet probabilities
  const homeCleanSheetProb = poisson(awayExpected, 0);
  const awayCleanSheetProb = poisson(homeExpected, 0);
  
  // Historical BTTS rate as additional factor
  const historicalBtts = (homeStats.bttsRate + awayStats.bttsRate) / 2;
  
  // Blend Poisson with historical (60% Poisson, 40% historical)
  const adjustedBttsYes = bttsYesProb * 0.6 + historicalBtts * 0.4;
  const adjustedBttsNo = 1 - adjustedBttsYes;
  
  // Recommendation
  let recommendation: "YES" | "NO" | "SKIP" = "SKIP";
  let confidence = 0;
  
  if (adjustedBttsYes > 0.58) {
    recommendation = "YES";
    confidence = Math.round(adjustedBttsYes * 100);
  } else if (adjustedBttsNo > 0.55) {
    recommendation = "NO";
    confidence = Math.round(adjustedBttsNo * 100);
  } else {
    confidence = Math.round(Math.max(adjustedBttsYes, adjustedBttsNo) * 100);
  }
  
  // Insight
  let insight = "";
  if (adjustedBttsYes > 0.65) {
    insight = `Both teams score frequently (${Math.round(historicalBtts * 100)}% historical)`;
  } else if (adjustedBttsNo > 0.60) {
    insight = `Strong defensive matchup, clean sheet likely`;
  } else {
    insight = `Close call - ${Math.round(homeStats.failedToScoreRate * 100)}% home blank rate`;
  }
  
  return {
    yesProbability: Math.round(adjustedBttsYes * 100),
    noProbability: Math.round(adjustedBttsNo * 100),
    recommendation,
    confidence,
    homeCleanSheetProb: Math.round(homeCleanSheetProb * 100),
    awayCleanSheetProb: Math.round(awayCleanSheetProb * 100),
    insight,
  };
}

// ============= ASIAN HANDICAP PREDICTION =============

function predictAsianHandicap(
  homeStats: TeamGoalStats,
  awayStats: TeamGoalStats
): AsianHandicapPrediction[] {
  const homeExpected = (homeStats.homeAvgScored + awayStats.awayAvgConceded) / 2;
  const awayExpected = (awayStats.awayAvgScored + homeStats.homeAvgConceded) / 2;
  const expectedMargin = homeExpected - awayExpected;
  
  // Generate score matrix
  const maxGoals = 6;
  const scoreMatrix: number[][] = [];
  
  for (let h = 0; h <= maxGoals; h++) {
    scoreMatrix[h] = [];
    for (let a = 0; a <= maxGoals; a++) {
      scoreMatrix[h][a] = poisson(homeExpected, h) * poisson(awayExpected, a);
    }
  }
  
  // Calculate cover probabilities for different lines
  const lines = [-2.5, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2.5];
  const predictions: AsianHandicapPrediction[] = [];
  
  for (const line of lines) {
    // Home covers if (home_goals - away_goals) > -line
    // For home -0.5, home needs to win by 1+
    // For home -1.5, home needs to win by 2+
    let homeCoverProb = 0;
    
    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        const margin = h - a;
        // Asian handicap: home team gets the line added to their score
        if (margin > -line) {
          homeCoverProb += scoreMatrix[h][a];
        }
      }
    }
    
    const awayCoverProb = 1 - homeCoverProb;
    
    // Determine which side to recommend
    const team = line <= 0 ? "HOME" : "AWAY";
    const coverProb = line <= 0 ? homeCoverProb : awayCoverProb;
    
    let recommendation: "BACK" | "SKIP" = "SKIP";
    let confidence = Math.round(coverProb * 100);
    
    if (coverProb > 0.55) {
      recommendation = "BACK";
    }
    
    // Insight based on line
    let insight = "";
    if (line === -0.5) {
      insight = `Home win probability: ${Math.round(homeCoverProb * 100)}%`;
    } else if (line === 0.5) {
      insight = `Away win or draw: ${Math.round(awayCoverProb * 100)}%`;
    } else if (line === -1.5) {
      insight = `Home wins by 2+: ${Math.round(homeCoverProb * 100)}%`;
    } else {
      insight = `Expected margin: ${expectedMargin > 0 ? "+" : ""}${expectedMargin.toFixed(1)}`;
    }
    
    predictions.push({
      line,
      team,
      coverProbability: Math.round(coverProb * 100),
      recommendation,
      confidence,
      expectedMargin,
      insight,
    });
  }
  
  // Only return the most relevant lines
  return predictions.filter(p => 
    [-1.5, -1, -0.5, 0, 0.5, 1, 1.5].includes(p.line)
  );
}

// ============= DOUBLE CHANCE PREDICTION =============

function predictDoubleChance(
  homeStats: TeamGoalStats,
  awayStats: TeamGoalStats
): DoubleChancePrediction[] {
  const homeExpected = (homeStats.homeAvgScored + awayStats.awayAvgConceded) / 2;
  const awayExpected = (awayStats.awayAvgScored + homeStats.homeAvgConceded) / 2;
  
  // Generate score matrix
  const maxGoals = 6;
  let homeWinProb = 0;
  let drawProb = 0;
  let awayWinProb = 0;
  
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const prob = poisson(homeExpected, h) * poisson(awayExpected, a);
      if (h > a) homeWinProb += prob;
      else if (h === a) drawProb += prob;
      else awayWinProb += prob;
    }
  }
  
  const predictions: DoubleChancePrediction[] = [
    {
      outcome: "1X",
      probability: Math.round((homeWinProb + drawProb) * 100),
      recommendation: (homeWinProb + drawProb) > 0.65 ? "BACK" : "SKIP",
      confidence: Math.round((homeWinProb + drawProb) * 100),
      insight: `Home win or draw - safe bet if home team is solid`,
    },
    {
      outcome: "X2",
      probability: Math.round((drawProb + awayWinProb) * 100),
      recommendation: (drawProb + awayWinProb) > 0.60 ? "BACK" : "SKIP",
      confidence: Math.round((drawProb + awayWinProb) * 100),
      insight: `Draw or away win - good for strong away sides`,
    },
    {
      outcome: "12",
      probability: Math.round((homeWinProb + awayWinProb) * 100),
      recommendation: (homeWinProb + awayWinProb) > 0.75 ? "BACK" : "SKIP",
      confidence: Math.round((homeWinProb + awayWinProb) * 100),
      insight: `No draw - decisive result expected`,
    },
  ];
  
  return predictions;
}

// ============= CORRECT SCORE DISTRIBUTION =============

function predictCorrectScores(
  homeStats: TeamGoalStats,
  awayStats: TeamGoalStats,
  topN: number = 5
): CorrectScorePrediction[] {
  const homeExpected = (homeStats.homeAvgScored + awayStats.awayAvgConceded) / 2;
  const awayExpected = (awayStats.awayAvgScored + homeStats.homeAvgConceded) / 2;
  
  const scores: CorrectScorePrediction[] = [];
  const maxGoals = 5;
  
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const prob = poisson(homeExpected, h) * poisson(awayExpected, a);
      scores.push({
        homeGoals: h,
        awayGoals: a,
        probability: Math.round(prob * 1000) / 10,  // One decimal precision
      });
    }
  }
  
  // Sort by probability and return top N
  return scores
    .sort((a, b) => b.probability - a.probability)
    .slice(0, topN);
}

function getGoalDistribution(expectedGoals: number): GoalDistribution[] {
  const distribution: GoalDistribution[] = [];
  
  for (let goals = 0; goals <= 5; goals++) {
    distribution.push({
      goals,
      probability: Math.round(poisson(expectedGoals, goals) * 100),
    });
  }
  
  return distribution;
}

// ============= MAIN PREDICTION FUNCTION =============

export function predictBettingMarkets(
  homeTeam: string,
  awayTeam: string
): BettingMarketsPrediction | null {
  console.log(`[Betting Markets] Analyzing ${homeTeam} vs ${awayTeam}`);
  
  const homeStats = getTeamGoalStats(homeTeam);
  const awayStats = getTeamGoalStats(awayTeam);
  
  if (!homeStats || !awayStats) {
    console.log(`[Betting Markets] Insufficient data for ${homeTeam} or ${awayTeam}`);
    return null;
  }
  
  // Calculate expected goals
  const expectedHomeGoals = (homeStats.homeAvgScored + awayStats.awayAvgConceded) / 2;
  const expectedAwayGoals = (awayStats.awayAvgScored + homeStats.homeAvgConceded) / 2;
  const expectedTotalGoals = expectedHomeGoals + expectedAwayGoals;
  
  // Generate all predictions
  const overUnder = predictOverUnder(homeStats, awayStats, true);
  const btts = predictBTTS(homeStats, awayStats);
  const asianHandicap = predictAsianHandicap(homeStats, awayStats);
  const doubleChance = predictDoubleChance(homeStats, awayStats);
  const topCorrectScores = predictCorrectScores(homeStats, awayStats);
  
  const homeGoalDistribution = getGoalDistribution(expectedHomeGoals);
  const awayGoalDistribution = getGoalDistribution(expectedAwayGoals);
  
  // Generate best bets (high confidence recommendations)
  const bestBets: string[] = [];
  
  // Check Over/Under
  const ou25 = overUnder.find(o => o.line === 2.5);
  if (ou25 && ou25.confidence >= 65) {
    bestBets.push(`${ou25.recommendation} 2.5 Goals (${ou25.confidence}%)`);
  }
  
  // Check BTTS
  if (btts.confidence >= 60) {
    bestBets.push(`BTTS ${btts.recommendation} (${btts.confidence}%)`);
  }
  
  // Check Asian Handicap
  const bestAH = asianHandicap.find(ah => ah.confidence >= 60);
  if (bestAH) {
    bestBets.push(`${bestAH.team} ${bestAH.line > 0 ? "+" : ""}${bestAH.line} (${bestAH.confidence}%)`);
  }
  
  // Check Double Chance
  const bestDC = doubleChance.find(dc => dc.confidence >= 70);
  if (bestDC) {
    bestBets.push(`Double Chance ${bestDC.outcome} (${bestDC.confidence}%)`);
  }
  
  console.log(`[Betting Markets] Expected: ${expectedHomeGoals.toFixed(1)} - ${expectedAwayGoals.toFixed(1)}`);
  console.log(`[Betting Markets] Best bets: ${bestBets.join(", ") || "No high-confidence bets"}`);
  
  return {
    homeTeam,
    awayTeam,
    expectedHomeGoals: Math.round(expectedHomeGoals * 10) / 10,
    expectedAwayGoals: Math.round(expectedAwayGoals * 10) / 10,
    expectedTotalGoals: Math.round(expectedTotalGoals * 10) / 10,
    overUnder,
    btts,
    asianHandicap,
    doubleChance,
    topCorrectScores,
    homeGoalDistribution,
    awayGoalDistribution,
    bestBets,
  };
}

// ============= HELPER: Get historical line performance =============

export function getHistoricalLinePerformance(
  teamName: string,
  line: number = 2.5
): { overRate: number; underRate: number; games: number } {
  const stats = getTeamGoalStats(teamName);
  
  if (!stats) {
    return { overRate: 50, underRate: 50, games: 0 };
  }
  
  let rate = 0;
  switch (line) {
    case 1.5:
      rate = stats.over15Rate;
      break;
    case 2.5:
      rate = stats.over25Rate;
      break;
    case 3.5:
      rate = stats.over35Rate;
      break;
    default:
      rate = 0.5;
  }
  
  return {
    overRate: Math.round(rate * 100),
    underRate: Math.round((1 - rate) * 100),
    games: stats.gamesPlayed,
  };
}
