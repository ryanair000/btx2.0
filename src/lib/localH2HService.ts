/**
 * Local H2H Service - Uses historical Premier League data (1993-2024)
 * 12,160+ matches for comprehensive head-to-head analysis
 */

import fs from "fs";
import path from "path";

interface HistoricalMatch {
  matchId: string;
  season: string;
  matchWeek: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  result: "H" | "D" | "A";
}

export interface LocalH2HResult {
  totalMatches: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  homeTeamName: string;
  awayTeamName: string;
  matches: Array<{
    date: string;
    season: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    result: "H" | "D" | "A";
    venue: "home" | "away"; // Whether the "home team" in our search was actually home
  }>;
  // Stats breakdown
  homeTeamHomeWins: number;  // Wins when playing at home
  homeTeamAwayWins: number;  // Wins when playing away
  avgGoalsPerMatch: number;
  recentForm: string; // Last 5 results from home team perspective (e.g., "WDLWW")
}

// Team name mapping from Football-Data.org to local CSV names
const TEAM_NAME_MAP: Record<string, string[]> = {
  // Football-Data.org name -> possible CSV names
  "Arsenal FC": ["Arsenal"],
  "Liverpool FC": ["Liverpool"],
  "Manchester City FC": ["Man City", "Manchester City"],
  "Manchester United FC": ["Man United", "Manchester United"],
  "Chelsea FC": ["Chelsea"],
  "Tottenham Hotspur FC": ["Tottenham", "Spurs"],
  "Newcastle United FC": ["Newcastle", "Newcastle United"],
  "West Ham United FC": ["West Ham", "West Ham United"],
  "Aston Villa FC": ["Aston Villa"],
  "Brighton & Hove Albion FC": ["Brighton", "Brighton And Hove Albion"],
  "Fulham FC": ["Fulham"],
  "Brentford FC": ["Brentford"],
  "Crystal Palace FC": ["Crystal Palace"],
  "Wolverhampton Wanderers FC": ["Wolves", "Wolverhampton", "Wolverhampton Wanderers"],
  "AFC Bournemouth": ["Bournemouth"],
  "Nottingham Forest FC": ["Nottingham Forest", "Nott'm Forest"],
  "Everton FC": ["Everton"],
  "Leicester City FC": ["Leicester", "Leicester City"],
  "Southampton FC": ["Southampton"],
  "Ipswich Town FC": ["Ipswich", "Ipswich Town"],
  "Leeds United FC": ["Leeds", "Leeds United"],
  "Burnley FC": ["Burnley"],
  "Luton Town FC": ["Luton", "Luton Town"],
  "Sheffield United FC": ["Sheffield United"],
};

let cachedData: HistoricalMatch[] | null = null;

/**
 * Load and parse the Premier League CSV data
 */
function loadHistoricalData(): HistoricalMatch[] {
  if (cachedData) {
    return cachedData;
  }

  const csvPath = path.join(process.cwd(), "data", "PremierLeague.csv");
  
  if (!fs.existsSync(csvPath)) {
    console.warn("[Local H2H] PremierLeague.csv not found at:", csvPath);
    return [];
  }

  const fileContent = fs.readFileSync(csvPath, "utf-8");
  const lines = fileContent.split("\n");
  
  // Skip header
  const matches: HistoricalMatch[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV (handling commas in fields)
    const fields = parseCSVLine(line);
    if (fields.length < 10) continue;
    
    const [matchId, season, matchWeek, date, , homeTeam, awayTeam, homeGoals, awayGoals, result] = fields;
    
    matches.push({
      matchId,
      season,
      matchWeek: parseInt(matchWeek) || 0,
      date,
      homeTeam: homeTeam.trim(),
      awayTeam: awayTeam.trim(),
      homeGoals: parseInt(homeGoals) || 0,
      awayGoals: parseInt(awayGoals) || 0,
      result: result as "H" | "D" | "A",
    });
  }

  console.log(`[Local H2H] Loaded ${matches.length} historical matches`);
  cachedData = matches;
  return matches;
}

/**
 * Simple CSV line parser
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

/**
 * Normalize team name for matching
 */
function normalizeTeamName(name: string): string[] {
  // Check if we have a mapping
  const mapped = TEAM_NAME_MAP[name];
  if (mapped) return mapped;
  
  // Try to extract core name
  const coreName = name
    .replace(" FC", "")
    .replace(" AFC", "")
    .replace("AFC ", "")
    .trim();
  
  return [coreName, name];
}

/**
 * Check if a team name matches
 */
function teamMatches(csvName: string, searchName: string): boolean {
  const searchVariants = normalizeTeamName(searchName);
  const csvLower = csvName.toLowerCase();
  
  return searchVariants.some(variant => 
    csvLower === variant.toLowerCase() ||
    csvLower.includes(variant.toLowerCase()) ||
    variant.toLowerCase().includes(csvLower)
  );
}

/**
 * Get H2H data from local historical data
 * @param homeTeamName Team name from Football-Data.org
 * @param awayTeamName Team name from Football-Data.org
 * @param limit Maximum matches to return (default 10)
 */
export function getLocalH2H(
  homeTeamName: string,
  awayTeamName: string,
  limit: number = 10
): LocalH2HResult | null {
  const allMatches = loadHistoricalData();
  
  if (allMatches.length === 0) {
    console.warn("[Local H2H] No historical data available");
    return null;
  }

  // Find all matches between these two teams
  const h2hMatches = allMatches.filter(m => {
    const homeMatch = teamMatches(m.homeTeam, homeTeamName) || teamMatches(m.homeTeam, awayTeamName);
    const awayMatch = teamMatches(m.awayTeam, homeTeamName) || teamMatches(m.awayTeam, awayTeamName);
    
    // Both teams must be in the match
    const team1InMatch = teamMatches(m.homeTeam, homeTeamName) || teamMatches(m.awayTeam, homeTeamName);
    const team2InMatch = teamMatches(m.homeTeam, awayTeamName) || teamMatches(m.awayTeam, awayTeamName);
    
    return team1InMatch && team2InMatch;
  });

  if (h2hMatches.length === 0) {
    console.log(`[Local H2H] No matches found between "${homeTeamName}" and "${awayTeamName}"`);
    return null;
  }

  // Sort by date (most recent first)
  h2hMatches.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  // Take the last N matches
  const recentMatches = h2hMatches.slice(0, limit);

  // Calculate stats
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let homeTeamHomeWins = 0;
  let homeTeamAwayWins = 0;
  let totalGoals = 0;

  const processedMatches = recentMatches.map(m => {
    totalGoals += m.homeGoals + m.awayGoals;
    
    // Determine if our "home team" was actually home in this match
    const ourHomeTeamWasHome = teamMatches(m.homeTeam, homeTeamName);
    
    let resultForOurHomeTeam: "H" | "D" | "A";
    
    if (m.result === "D") {
      draws++;
      resultForOurHomeTeam = "D";
    } else if (ourHomeTeamWasHome) {
      // Our home team was actually home
      if (m.result === "H") {
        homeWins++;
        homeTeamHomeWins++;
        resultForOurHomeTeam = "H";
      } else {
        awayWins++;
        resultForOurHomeTeam = "A";
      }
    } else {
      // Our home team was away
      if (m.result === "A") {
        homeWins++;
        homeTeamAwayWins++;
        resultForOurHomeTeam = "H";
      } else {
        awayWins++;
        resultForOurHomeTeam = "A";
      }
    }

    return {
      date: m.date,
      season: m.season,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeScore: m.homeGoals,
      awayScore: m.awayGoals,
      result: resultForOurHomeTeam,
      venue: ourHomeTeamWasHome ? "home" as const : "away" as const,
    };
  });

  // Generate recent form string (last 5 from home team perspective)
  const recentForm = processedMatches
    .slice(0, 5)
    .map(m => {
      if (m.result === "H") return "W";
      if (m.result === "D") return "D";
      return "L";
    })
    .join("");

  const result: LocalH2HResult = {
    totalMatches: recentMatches.length,
    homeWins,
    draws,
    awayWins,
    homeTeamName,
    awayTeamName,
    matches: processedMatches,
    homeTeamHomeWins,
    homeTeamAwayWins,
    avgGoalsPerMatch: recentMatches.length > 0 ? totalGoals / recentMatches.length : 0,
    recentForm,
  };

  console.log(`[Local H2H] Found ${recentMatches.length} H2H matches: ${homeTeamName} ${homeWins}-${draws}-${awayWins} ${awayTeamName}`);
  
  return result;
}

/**
 * Get full H2H history (all matches ever played)
 */
export function getFullH2HHistory(
  homeTeamName: string,
  awayTeamName: string
): LocalH2HResult | null {
  return getLocalH2H(homeTeamName, awayTeamName, 999);
}

/**
 * Format H2H for display
 */
export function formatLocalH2HInsight(h2h: LocalH2HResult | null): string {
  if (!h2h || h2h.totalMatches === 0) {
    return "No historical H2H data available";
  }

  const insights: string[] = [];
  
  // Overall record
  insights.push(`Last ${h2h.totalMatches} meetings: ${h2h.homeWins}W-${h2h.draws}D-${h2h.awayWins}L`);
  
  // Dominant team
  if (h2h.homeWins > h2h.awayWins * 1.5) {
    insights.push(`${h2h.homeTeamName} dominates this fixture`);
  } else if (h2h.awayWins > h2h.homeWins * 1.5) {
    insights.push(`${h2h.awayTeamName} dominates this fixture`);
  } else if (h2h.draws >= h2h.homeWins && h2h.draws >= h2h.awayWins) {
    insights.push("Historically tight fixture - many draws");
  }
  
  // Goals
  if (h2h.avgGoalsPerMatch > 3) {
    insights.push(`High-scoring fixture (avg ${h2h.avgGoalsPerMatch.toFixed(1)} goals/game)`);
  } else if (h2h.avgGoalsPerMatch < 2) {
    insights.push(`Low-scoring fixture (avg ${h2h.avgGoalsPerMatch.toFixed(1)} goals/game)`);
  }
  
  // Recent form
  if (h2h.recentForm) {
    insights.push(`Recent H2H form: ${h2h.recentForm}`);
  }

  return insights.join(". ");
}
