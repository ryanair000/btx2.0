/**
 * Elo Rating Service
 * 
 * Implements a dynamic Elo rating system for Premier League teams.
 * Elo ratings persist between sessions and update after each match result.
 * 
 * Key features:
 * - K-factor adjustment based on goal difference
 * - Home advantage built into expected score
 * - Season regression to prevent extreme ratings
 * - Historical tracking for trend analysis
 * 
 * Expected accuracy improvement: +4-6%
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const ELO_FILE = path.join(DATA_DIR, 'elo_ratings.json');

// Elo configuration
const BASE_RATING = 1500;
const K_FACTOR = 32;  // Standard K-factor for competitive matches
const HOME_ADVANTAGE = 65;  // Home team gets ~65 rating points boost
const SEASON_REGRESSION = 0.67;  // Regress 33% to mean at season start

export interface TeamElo {
  team: string;
  rating: number;
  peak: number;
  low: number;
  matchesPlayed: number;
  lastUpdated: string;
  history: Array<{ date: string; rating: number; opponent: string; result: string }>;
}

export interface EloData {
  ratings: Record<string, TeamElo>;
  lastSeasonReset: string;
  version: string;
}

// Premier League teams with initial ratings based on historical performance
const INITIAL_RATINGS: Record<string, number> = {
  "Manchester City": 1750,
  "Liverpool": 1720,
  "Arsenal": 1700,
  "Chelsea": 1650,
  "Manchester United": 1620,
  "Tottenham Hotspur": 1600,
  "Newcastle United": 1580,
  "Aston Villa": 1560,
  "Brighton & Hove Albion": 1540,
  "West Ham United": 1520,
  "Wolverhampton Wanderers": 1500,
  "Crystal Palace": 1490,
  "Bournemouth": 1480,
  "Fulham": 1480,
  "Brentford": 1480,
  "Everton": 1470,
  "Nottingham Forest": 1460,
  "Leicester City": 1450,
  "Ipswich Town": 1420,
  "Southampton": 1400,
};

// Team name aliases for matching
const TEAM_ALIASES: Record<string, string[]> = {
  "Manchester City": ["Man City", "Man. City"],
  "Manchester United": ["Man United", "Man Utd", "Man. United"],
  "Tottenham Hotspur": ["Tottenham", "Spurs"],
  "Wolverhampton Wanderers": ["Wolves", "Wolverhampton"],
  "Brighton & Hove Albion": ["Brighton", "Brighton & Hove"],
  "Newcastle United": ["Newcastle"],
  "West Ham United": ["West Ham"],
  "Nottingham Forest": ["Nott'm Forest", "Forest"],
  "Leicester City": ["Leicester"],
  "Ipswich Town": ["Ipswich"],
};

function normalizeTeamName(name: string): string {
  const searchName = name.toLowerCase().trim();
  
  // Check exact matches first
  for (const [canonical, aliases] of Object.entries(TEAM_ALIASES)) {
    if (canonical.toLowerCase() === searchName) return canonical;
    for (const alias of aliases) {
      if (alias.toLowerCase() === searchName) return canonical;
    }
  }
  
  // Check partial matches
  for (const [canonical, aliases] of Object.entries(TEAM_ALIASES)) {
    if (searchName.includes(canonical.toLowerCase())) return canonical;
    for (const alias of aliases) {
      if (searchName.includes(alias.toLowerCase()) || alias.toLowerCase().includes(searchName)) {
        return canonical;
      }
    }
  }
  
  // Return as-is if no match found
  return name;
}

function loadEloData(): EloData {
  try {
    if (fs.existsSync(ELO_FILE)) {
      const data = fs.readFileSync(ELO_FILE, 'utf-8');
      return JSON.parse(data) as EloData;
    }
  } catch (error) {
    console.warn('[ELO] Error loading ratings, initializing fresh:', error);
  }
  
  // Initialize with default ratings
  return initializeEloData();
}

function initializeEloData(): EloData {
  const ratings: Record<string, TeamElo> = {};
  const now = new Date().toISOString();
  
  for (const [team, rating] of Object.entries(INITIAL_RATINGS)) {
    ratings[team] = {
      team,
      rating,
      peak: rating,
      low: rating,
      matchesPlayed: 0,
      lastUpdated: now,
      history: [],
    };
  }
  
  return {
    ratings,
    lastSeasonReset: now,
    version: '1.0',
  };
}

function saveEloData(data: EloData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(ELO_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log('[ELO] Ratings saved successfully');
  } catch (error) {
    console.error('[ELO] Error saving ratings:', error);
  }
}

/**
 * Calculate expected score using Elo formula
 * Returns probability of team A winning (0-1)
 */
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate K-factor multiplier based on goal difference
 * Bigger wins = bigger rating change
 */
function goalDifferenceMultiplier(goalDiff: number): number {
  const absGoalDiff = Math.abs(goalDiff);
  if (absGoalDiff <= 1) return 1.0;
  if (absGoalDiff === 2) return 1.5;
  return 1.75 + (absGoalDiff - 3) * 0.125;
}

/**
 * Get current Elo rating for a team
 */
export function getTeamRating(teamName: string): number {
  const data = loadEloData();
  const normalizedName = normalizeTeamName(teamName);
  return data.ratings[normalizedName]?.rating || BASE_RATING;
}

/**
 * Get full Elo info for a team
 */
export function getTeamElo(teamName: string): TeamElo | null {
  const data = loadEloData();
  const normalizedName = normalizeTeamName(teamName);
  return data.ratings[normalizedName] || null;
}

/**
 * Get all team ratings sorted by rating
 */
export function getAllRatings(): TeamElo[] {
  const data = loadEloData();
  return Object.values(data.ratings).sort((a, b) => b.rating - a.rating);
}

/**
 * Calculate win/draw/loss probabilities using Elo ratings
 * Includes home advantage adjustment
 */
export function calculateEloProbabilities(
  homeTeam: string,
  awayTeam: string
): { home: number; draw: number; away: number; homeElo: number; awayElo: number } {
  const homeRating = getTeamRating(homeTeam) + HOME_ADVANTAGE;
  const awayRating = getTeamRating(awayTeam);
  
  // Expected score for home team
  const homeExpected = expectedScore(homeRating, awayRating);
  const awayExpected = 1 - homeExpected;
  
  // Convert to win/draw/loss probabilities
  // Draw probability increases when teams are closer in rating
  const ratingDiff = Math.abs(homeRating - awayRating);
  const drawBase = 0.25;  // PL average draw rate ~25%
  const drawAdjustment = Math.max(0, 0.12 - (ratingDiff / 1000));  // More draws for close matches
  const drawProb = drawBase + drawAdjustment;
  
  // Distribute remaining probability
  const remaining = 1 - drawProb;
  const homeProb = homeExpected * remaining;
  const awayProb = awayExpected * remaining;
  
  return {
    home: Math.round(homeProb * 100),
    draw: Math.round(drawProb * 100),
    away: Math.round(awayProb * 100),
    homeElo: Math.round(homeRating),
    awayElo: Math.round(awayRating),
  };
}

/**
 * Update Elo ratings after a match result
 */
export function updateRatings(
  homeTeam: string,
  awayTeam: string,
  homeGoals: number,
  awayGoals: number,
  matchDate?: string
): { homeNewRating: number; awayNewRating: number; homeChange: number; awayChange: number } {
  const data = loadEloData();
  const homeNorm = normalizeTeamName(homeTeam);
  const awayNorm = normalizeTeamName(awayTeam);
  const date = matchDate || new Date().toISOString();
  
  // Ensure teams exist in ratings
  if (!data.ratings[homeNorm]) {
    data.ratings[homeNorm] = {
      team: homeNorm,
      rating: BASE_RATING,
      peak: BASE_RATING,
      low: BASE_RATING,
      matchesPlayed: 0,
      lastUpdated: date,
      history: [],
    };
  }
  if (!data.ratings[awayNorm]) {
    data.ratings[awayNorm] = {
      team: awayNorm,
      rating: BASE_RATING,
      peak: BASE_RATING,
      low: BASE_RATING,
      matchesPlayed: 0,
      lastUpdated: date,
      history: [],
    };
  }
  
  const homeRating = data.ratings[homeNorm].rating + HOME_ADVANTAGE;
  const awayRating = data.ratings[awayNorm].rating;
  
  // Calculate expected scores
  const homeExpected = expectedScore(homeRating, awayRating);
  const awayExpected = 1 - homeExpected;
  
  // Actual scores (1 = win, 0.5 = draw, 0 = loss)
  let homeActual: number;
  let awayActual: number;
  
  if (homeGoals > awayGoals) {
    homeActual = 1;
    awayActual = 0;
  } else if (homeGoals < awayGoals) {
    homeActual = 0;
    awayActual = 1;
  } else {
    homeActual = 0.5;
    awayActual = 0.5;
  }
  
  // Calculate rating changes
  const goalDiff = homeGoals - awayGoals;
  const gdMultiplier = goalDifferenceMultiplier(goalDiff);
  
  const homeChange = K_FACTOR * gdMultiplier * (homeActual - homeExpected);
  const awayChange = K_FACTOR * gdMultiplier * (awayActual - awayExpected);
  
  // Update ratings
  const homeNewRating = Math.round(data.ratings[homeNorm].rating + homeChange);
  const awayNewRating = Math.round(data.ratings[awayNorm].rating + awayChange);
  
  // Update home team
  data.ratings[homeNorm].rating = homeNewRating;
  data.ratings[homeNorm].matchesPlayed++;
  data.ratings[homeNorm].lastUpdated = date;
  data.ratings[homeNorm].peak = Math.max(data.ratings[homeNorm].peak, homeNewRating);
  data.ratings[homeNorm].low = Math.min(data.ratings[homeNorm].low, homeNewRating);
  data.ratings[homeNorm].history.push({
    date,
    rating: homeNewRating,
    opponent: awayNorm,
    result: homeGoals > awayGoals ? 'W' : homeGoals < awayGoals ? 'L' : 'D',
  });
  
  // Update away team
  data.ratings[awayNorm].rating = awayNewRating;
  data.ratings[awayNorm].matchesPlayed++;
  data.ratings[awayNorm].lastUpdated = date;
  data.ratings[awayNorm].peak = Math.max(data.ratings[awayNorm].peak, awayNewRating);
  data.ratings[awayNorm].low = Math.min(data.ratings[awayNorm].low, awayNewRating);
  data.ratings[awayNorm].history.push({
    date,
    rating: awayNewRating,
    opponent: homeNorm,
    result: awayGoals > homeGoals ? 'W' : awayGoals < homeGoals ? 'L' : 'D',
  });
  
  // Keep only last 50 history entries per team
  if (data.ratings[homeNorm].history.length > 50) {
    data.ratings[homeNorm].history = data.ratings[homeNorm].history.slice(-50);
  }
  if (data.ratings[awayNorm].history.length > 50) {
    data.ratings[awayNorm].history = data.ratings[awayNorm].history.slice(-50);
  }
  
  // Save updated ratings
  saveEloData(data);
  
  console.log(`[ELO] ${homeNorm}: ${Math.round(data.ratings[homeNorm].rating - homeChange)} → ${homeNewRating} (${homeChange >= 0 ? '+' : ''}${Math.round(homeChange)})`);
  console.log(`[ELO] ${awayNorm}: ${Math.round(data.ratings[awayNorm].rating - awayChange)} → ${awayNewRating} (${awayChange >= 0 ? '+' : ''}${Math.round(awayChange)})`);
  
  return {
    homeNewRating,
    awayNewRating,
    homeChange: Math.round(homeChange),
    awayChange: Math.round(awayChange),
  };
}

/**
 * Apply season regression - call at start of new season
 * Regresses all ratings toward the mean to account for transfers and changes
 */
export function applySeasonRegression(): void {
  const data = loadEloData();
  const avgRating = Object.values(data.ratings).reduce((sum, t) => sum + t.rating, 0) / 
                    Object.values(data.ratings).length;
  
  for (const team of Object.values(data.ratings)) {
    const oldRating = team.rating;
    team.rating = Math.round(avgRating + (team.rating - avgRating) * SEASON_REGRESSION);
    console.log(`[ELO] Season regression: ${team.team} ${oldRating} → ${team.rating}`);
  }
  
  data.lastSeasonReset = new Date().toISOString();
  saveEloData(data);
}

/**
 * Get Elo-based prediction impact for the prediction engine
 */
export function getEloPredictionImpact(
  homeTeam: string,
  awayTeam: string
): {
  homeImpact: number;
  awayImpact: number;
  eloProbabilities: { home: number; draw: number; away: number };
  insight: string;
} {
  const probs = calculateEloProbabilities(homeTeam, awayTeam);
  
  // Convert Elo advantage to impact score (-0.3 to +0.3)
  const eloDiff = probs.homeElo - probs.awayElo;
  const homeImpact = Math.max(-0.3, Math.min(0.3, eloDiff / 500));
  const awayImpact = -homeImpact;
  
  // Generate insight
  let insight: string;
  if (Math.abs(eloDiff) < 50) {
    insight = "Elo ratings very close - evenly matched";
  } else if (eloDiff > 150) {
    insight = `${homeTeam} heavily favored by Elo (+${eloDiff} rating advantage)`;
  } else if (eloDiff > 75) {
    insight = `${homeTeam} favored by Elo ratings`;
  } else if (eloDiff < -150) {
    insight = `${awayTeam} heavily favored by Elo (+${Math.abs(eloDiff)} rating advantage)`;
  } else if (eloDiff < -75) {
    insight = `${awayTeam} favored by Elo ratings`;
  } else {
    insight = "Slight Elo advantage to " + (eloDiff > 0 ? homeTeam : awayTeam);
  }
  
  return {
    homeImpact,
    awayImpact,
    eloProbabilities: {
      home: probs.home,
      draw: probs.draw,
      away: probs.away,
    },
    insight,
  };
}

/**
 * Bulk update ratings from historical match data
 */
export function bulkUpdateFromMatches(
  matches: Array<{
    homeTeam: string;
    awayTeam: string;
    homeGoals: number;
    awayGoals: number;
    date: string;
  }>
): void {
  // Sort by date (oldest first)
  const sorted = [...matches].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  console.log(`[ELO] Bulk updating ratings from ${sorted.length} matches...`);
  
  for (const match of sorted) {
    updateRatings(
      match.homeTeam,
      match.awayTeam,
      match.homeGoals,
      match.awayGoals,
      match.date
    );
  }
  
  console.log('[ELO] Bulk update complete');
}
