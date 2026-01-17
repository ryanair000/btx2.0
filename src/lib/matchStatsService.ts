/**
 * Football-Data.co.uk Match Statistics Service
 * 
 * Uses detailed match data including:
 * - Shots and shots on target
 * - Corners and fouls
 * - Cards (yellow/red)
 * - Betting odds (for market probability)
 * 
 * Data source: https://www.football-data.co.uk/
 */

import fs from "fs";
import path from "path";

export interface MatchStats {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  result: "H" | "D" | "A";
  halfTimeHomeGoals: number;
  halfTimeAwayGoals: number;
  referee: string;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeFouls: number;
  awayFouls: number;
  homeCorners: number;
  awayCorners: number;
  homeYellow: number;
  awayYellow: number;
  homeRed: number;
  awayRed: number;
  // Betting odds (market probability)
  oddsHome?: number;
  oddsDraw?: number;
  oddsAway?: number;
  season: string;
}

export interface TeamSeasonStats {
  team: string;
  season: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  // Advanced stats
  totalShots: number;
  totalShotsOnTarget: number;
  shotsPerGame: number;
  shotAccuracy: number;  // SoT / Shots
  shotsAgainst: number;
  shotsOnTargetAgainst: number;
  cornersFor: number;
  cornersAgainst: number;
  yellowCards: number;
  redCards: number;
  foulsCommitted: number;
  foulsSuffered: number;
  // Home/Away splits
  homeWins: number;
  homeDraws: number;
  homeLosses: number;
  awayWins: number;
  awayDraws: number;
  awayLosses: number;
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
}

export interface H2HStats {
  homeTeam: string;
  awayTeam: string;
  matches: MatchStats[];
  homeWins: number;
  draws: number;
  awayWins: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  avgTotalGoals: number;
  homeCleanSheets: number;
  awayCleanSheets: number;
}

// Team name mapping between Football-Data.co.uk and our system
const TEAM_NAME_MAP: Record<string, string[]> = {
  "Arsenal FC": ["Arsenal"],
  "Liverpool FC": ["Liverpool"],
  "Manchester City FC": ["Man City"],
  "Manchester United FC": ["Man United"],
  "Chelsea FC": ["Chelsea"],
  "Tottenham Hotspur FC": ["Tottenham"],
  "Newcastle United FC": ["Newcastle"],
  "West Ham United FC": ["West Ham"],
  "Aston Villa FC": ["Aston Villa"],
  "Brighton & Hove Albion FC": ["Brighton"],
  "Fulham FC": ["Fulham"],
  "Brentford FC": ["Brentford"],
  "Crystal Palace FC": ["Crystal Palace"],
  "Wolverhampton Wanderers FC": ["Wolves"],
  "AFC Bournemouth": ["Bournemouth"],
  "Nottingham Forest FC": ["Nott'm Forest", "Nottingham Forest"],
  "Everton FC": ["Everton"],
  "Leicester City FC": ["Leicester"],
  "Southampton FC": ["Southampton"],
  "Ipswich Town FC": ["Ipswich"],
  "Leeds United FC": ["Leeds"],
  "Burnley FC": ["Burnley"],
  "Luton Town FC": ["Luton"],
  "Sheffield United FC": ["Sheffield United"],
};

let cachedMatches: MatchStats[] | null = null;
let cachedByTeam: Map<string, MatchStats[]> | null = null;

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeTeamName(name: string): string {
  // Convert Football-Data.co.uk name to our standard format
  for (const [standard, variants] of Object.entries(TEAM_NAME_MAP)) {
    if (variants.includes(name)) {
      return standard;
    }
  }
  // If not found, append FC
  return name.includes("FC") ? name : `${name} FC`;
}

function isTeamMatch(dataTeam: string, searchTeam: string): boolean {
  const dataLower = dataTeam.toLowerCase();
  const searchLower = searchTeam.toLowerCase().replace(" fc", "").replace(" afc", "");
  
  // Direct match
  if (dataLower === searchLower) return true;
  if (dataLower.includes(searchLower)) return true;
  
  // Check our mapping
  const variants = TEAM_NAME_MAP[searchTeam] || [];
  return variants.some(v => dataLower === v.toLowerCase());
}

/**
 * Load all matches from Football-Data.co.uk CSVs
 */
export function loadAllMatches(): MatchStats[] {
  if (cachedMatches) return cachedMatches;
  
  const dataDir = path.join(process.cwd(), "data");
  const seasons = ["2425", "2324", "2223", "2122", "2021"];
  const matches: MatchStats[] = [];
  
  for (const season of seasons) {
    const csvPath = path.join(dataDir, `epl_${season}.csv`);
    
    if (!fs.existsSync(csvPath)) {
      console.log(`[Match Stats] ${csvPath} not found`);
      continue;
    }
    
    const content = fs.readFileSync(csvPath, "utf-8");
    const lines = content.split("\n");
    
    // Parse header to get column indices
    const header = parseCSVLine(lines[0]);
    const cols: Record<string, number> = {};
    header.forEach((col, idx) => {
      cols[col.replace(/[^\w]/g, "")] = idx;  // Remove BOM and special chars
    });
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const fields = parseCSVLine(line);
      if (fields.length < 20) continue;
      
      try {
        const match: MatchStats = {
          date: fields[cols["Date"] || 1],
          homeTeam: fields[cols["HomeTeam"] || 3],
          awayTeam: fields[cols["AwayTeam"] || 4],
          homeGoals: parseInt(fields[cols["FTHG"] || 5]) || 0,
          awayGoals: parseInt(fields[cols["FTAG"] || 6]) || 0,
          result: fields[cols["FTR"] || 7] as "H" | "D" | "A",
          halfTimeHomeGoals: parseInt(fields[cols["HTHG"] || 8]) || 0,
          halfTimeAwayGoals: parseInt(fields[cols["HTAG"] || 9]) || 0,
          referee: fields[cols["Referee"] || 11] || "",
          homeShots: parseInt(fields[cols["HS"] || 12]) || 0,
          awayShots: parseInt(fields[cols["AS"] || 13]) || 0,
          homeShotsOnTarget: parseInt(fields[cols["HST"] || 14]) || 0,
          awayShotsOnTarget: parseInt(fields[cols["AST"] || 15]) || 0,
          homeFouls: parseInt(fields[cols["HF"] || 16]) || 0,
          awayFouls: parseInt(fields[cols["AF"] || 17]) || 0,
          homeCorners: parseInt(fields[cols["HC"] || 18]) || 0,
          awayCorners: parseInt(fields[cols["AC"] || 19]) || 0,
          homeYellow: parseInt(fields[cols["HY"] || 20]) || 0,
          awayYellow: parseInt(fields[cols["AY"] || 21]) || 0,
          homeRed: parseInt(fields[cols["HR"] || 22]) || 0,
          awayRed: parseInt(fields[cols["AR"] || 23]) || 0,
          oddsHome: parseFloat(fields[cols["B365H"] || 24]) || undefined,
          oddsDraw: parseFloat(fields[cols["B365D"] || 25]) || undefined,
          oddsAway: parseFloat(fields[cols["B365A"] || 26]) || undefined,
          season: `20${season.slice(0, 2)}-${season.slice(2)}`,
        };
        
        matches.push(match);
      } catch (e) {
        // Skip malformed rows
      }
    }
  }
  
  console.log(`[Match Stats] Loaded ${matches.length} matches from Football-Data.co.uk`);
  cachedMatches = matches;
  return matches;
}

/**
 * Get season stats for a team
 */
export function getTeamSeasonStats(teamName: string, season?: string): TeamSeasonStats | null {
  const matches = loadAllMatches();
  const targetSeason = season || "2024-25";
  
  const teamMatches = matches.filter(m => 
    m.season === targetSeason && 
    (isTeamMatch(m.homeTeam, teamName) || isTeamMatch(m.awayTeam, teamName))
  );
  
  if (teamMatches.length === 0) {
    return null;
  }
  
  const stats: TeamSeasonStats = {
    team: teamName,
    season: targetSeason,
    played: teamMatches.length,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
    totalShots: 0,
    totalShotsOnTarget: 0,
    shotsPerGame: 0,
    shotAccuracy: 0,
    shotsAgainst: 0,
    shotsOnTargetAgainst: 0,
    cornersFor: 0,
    cornersAgainst: 0,
    yellowCards: 0,
    redCards: 0,
    foulsCommitted: 0,
    foulsSuffered: 0,
    homeWins: 0,
    homeDraws: 0,
    homeLosses: 0,
    awayWins: 0,
    awayDraws: 0,
    awayLosses: 0,
    homeGoalsFor: 0,
    homeGoalsAgainst: 0,
    awayGoalsFor: 0,
    awayGoalsAgainst: 0,
  };
  
  for (const match of teamMatches) {
    const isHome = isTeamMatch(match.homeTeam, teamName);
    
    if (isHome) {
      stats.goalsFor += match.homeGoals;
      stats.goalsAgainst += match.awayGoals;
      stats.homeGoalsFor += match.homeGoals;
      stats.homeGoalsAgainst += match.awayGoals;
      stats.totalShots += match.homeShots;
      stats.totalShotsOnTarget += match.homeShotsOnTarget;
      stats.shotsAgainst += match.awayShots;
      stats.shotsOnTargetAgainst += match.awayShotsOnTarget;
      stats.cornersFor += match.homeCorners;
      stats.cornersAgainst += match.awayCorners;
      stats.yellowCards += match.homeYellow;
      stats.redCards += match.homeRed;
      stats.foulsCommitted += match.homeFouls;
      stats.foulsSuffered += match.awayFouls;
      
      if (match.result === "H") {
        stats.wins++;
        stats.homeWins++;
      } else if (match.result === "D") {
        stats.draws++;
        stats.homeDraws++;
      } else {
        stats.losses++;
        stats.homeLosses++;
      }
    } else {
      stats.goalsFor += match.awayGoals;
      stats.goalsAgainst += match.homeGoals;
      stats.awayGoalsFor += match.awayGoals;
      stats.awayGoalsAgainst += match.homeGoals;
      stats.totalShots += match.awayShots;
      stats.totalShotsOnTarget += match.awayShotsOnTarget;
      stats.shotsAgainst += match.homeShots;
      stats.shotsOnTargetAgainst += match.homeShotsOnTarget;
      stats.cornersFor += match.awayCorners;
      stats.cornersAgainst += match.homeCorners;
      stats.yellowCards += match.awayYellow;
      stats.redCards += match.awayRed;
      stats.foulsCommitted += match.awayFouls;
      stats.foulsSuffered += match.homeFouls;
      
      if (match.result === "A") {
        stats.wins++;
        stats.awayWins++;
      } else if (match.result === "D") {
        stats.draws++;
        stats.awayDraws++;
      } else {
        stats.losses++;
        stats.awayLosses++;
      }
    }
  }
  
  stats.goalDiff = stats.goalsFor - stats.goalsAgainst;
  stats.points = stats.wins * 3 + stats.draws;
  stats.shotsPerGame = stats.totalShots / stats.played;
  stats.shotAccuracy = stats.totalShots > 0 ? stats.totalShotsOnTarget / stats.totalShots : 0;
  
  return stats;
}

/**
 * Get head-to-head statistics between two teams
 */
export function getDetailedH2H(homeTeam: string, awayTeam: string, limit: number = 10): H2HStats | null {
  const matches = loadAllMatches();
  
  const h2hMatches = matches.filter(m => 
    (isTeamMatch(m.homeTeam, homeTeam) && isTeamMatch(m.awayTeam, awayTeam)) ||
    (isTeamMatch(m.homeTeam, awayTeam) && isTeamMatch(m.awayTeam, homeTeam))
  ).slice(0, limit);
  
  if (h2hMatches.length === 0) {
    return null;
  }
  
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;
  let homeCleanSheets = 0;
  let awayCleanSheets = 0;
  
  for (const match of h2hMatches) {
    const isOriginalHome = isTeamMatch(match.homeTeam, homeTeam);
    
    if (isOriginalHome) {
      totalHomeGoals += match.homeGoals;
      totalAwayGoals += match.awayGoals;
      if (match.result === "H") homeWins++;
      else if (match.result === "D") draws++;
      else awayWins++;
      if (match.awayGoals === 0) homeCleanSheets++;
      if (match.homeGoals === 0) awayCleanSheets++;
    } else {
      // Reversed fixture
      totalHomeGoals += match.awayGoals;
      totalAwayGoals += match.homeGoals;
      if (match.result === "A") homeWins++;
      else if (match.result === "D") draws++;
      else awayWins++;
      if (match.homeGoals === 0) homeCleanSheets++;
      if (match.awayGoals === 0) awayCleanSheets++;
    }
  }
  
  return {
    homeTeam,
    awayTeam,
    matches: h2hMatches,
    homeWins,
    draws,
    awayWins,
    avgHomeGoals: totalHomeGoals / h2hMatches.length,
    avgAwayGoals: totalAwayGoals / h2hMatches.length,
    avgTotalGoals: (totalHomeGoals + totalAwayGoals) / h2hMatches.length,
    homeCleanSheets,
    awayCleanSheets,
  };
}

/**
 * Get market probability from betting odds
 * This provides a "wisdom of the crowd" estimate
 */
export function getMarketProbability(homeTeam: string, awayTeam: string): {
  homeWin: number;
  draw: number;
  awayWin: number;
  insight: string;
} | null {
  const matches = loadAllMatches();
  
  // Get recent matches between these teams with odds
  const h2hMatches = matches.filter(m => 
    m.season === "2024-25" &&
    ((isTeamMatch(m.homeTeam, homeTeam) && isTeamMatch(m.awayTeam, awayTeam)) ||
     (isTeamMatch(m.homeTeam, awayTeam) && isTeamMatch(m.awayTeam, homeTeam)))
  );
  
  // If no direct H2H this season, get average odds for home team's home games
  const homeTeamMatches = matches.filter(m =>
    m.season === "2024-25" &&
    isTeamMatch(m.homeTeam, homeTeam) &&
    m.oddsHome
  );
  
  if (homeTeamMatches.length === 0) {
    return null;
  }
  
  // Average odds
  const avgOddsHome = homeTeamMatches.reduce((sum, m) => sum + (m.oddsHome || 0), 0) / homeTeamMatches.length;
  const avgOddsDraw = homeTeamMatches.reduce((sum, m) => sum + (m.oddsDraw || 0), 0) / homeTeamMatches.length;
  const avgOddsAway = homeTeamMatches.reduce((sum, m) => sum + (m.oddsAway || 0), 0) / homeTeamMatches.length;
  
  // Convert odds to probabilities (1/odds)
  const rawHomeProb = 1 / avgOddsHome;
  const rawDrawProb = 1 / avgOddsDraw;
  const rawAwayProb = 1 / avgOddsAway;
  
  // Normalize to 100% (remove bookmaker margin)
  const total = rawHomeProb + rawDrawProb + rawAwayProb;
  const homeProb = (rawHomeProb / total) * 100;
  const drawProb = (rawDrawProb / total) * 100;
  const awayProb = (rawAwayProb / total) * 100;
  
  // Generate insight
  let insight: string;
  if (homeProb > 50) {
    insight = `Market favors home win (${homeProb.toFixed(0)}%)`;
  } else if (awayProb > 40) {
    insight = `Market gives away team good chance (${awayProb.toFixed(0)}%)`;
  } else {
    insight = `Market expects close match`;
  }
  
  return {
    homeWin: Math.round(homeProb),
    draw: Math.round(drawProb),
    awayWin: Math.round(awayProb),
    insight,
  };
}

/**
 * Compare shot statistics between two teams
 */
export function compareShotStats(homeTeam: string, awayTeam: string): {
  homeAdvantage: number;
  homeShotsPerGame: number;
  awayShotsPerGame: number;
  homeShotAccuracy: number;
  awayShotAccuracy: number;
  insight: string;
} | null {
  const homeStats = getTeamSeasonStats(homeTeam);
  const awayStats = getTeamSeasonStats(awayTeam);
  
  if (!homeStats || !awayStats) {
    return null;
  }
  
  const homeShotsPerGame = homeStats.shotsPerGame;
  const awayShotsPerGame = awayStats.shotsPerGame;
  const homeShotAccuracy = homeStats.shotAccuracy * 100;
  const awayShotAccuracy = awayStats.shotAccuracy * 100;
  
  // Calculate advantage based on shots and accuracy
  const shotAdvantage = (homeShotsPerGame - awayShotsPerGame) * 2;
  const accuracyAdvantage = (homeShotAccuracy - awayShotAccuracy) * 0.5;
  const homeAdvantage = shotAdvantage + accuracyAdvantage;
  
  let insight: string;
  if (homeShotsPerGame > awayShotsPerGame + 3) {
    insight = `${homeTeam} creates more shots (${homeShotsPerGame.toFixed(1)} vs ${awayShotsPerGame.toFixed(1)})`;
  } else if (awayShotsPerGame > homeShotsPerGame + 3) {
    insight = `${awayTeam} creates more shots (${awayShotsPerGame.toFixed(1)} vs ${homeShotsPerGame.toFixed(1)})`;
  } else if (homeShotAccuracy > awayShotAccuracy + 5) {
    insight = `${homeTeam} more clinical (${homeShotAccuracy.toFixed(0)}% accuracy)`;
  } else {
    insight = `Similar shot profiles`;
  }
  
  return {
    homeAdvantage: Math.max(-20, Math.min(20, homeAdvantage)),
    homeShotsPerGame,
    awayShotsPerGame,
    homeShotAccuracy,
    awayShotAccuracy,
    insight,
  };
}

/**
 * Get referee statistics for a team
 */
export function getRefereeStats(referee: string, teamName: string): {
  gamesRefereed: number;
  teamWins: number;
  teamDraws: number;
  teamLosses: number;
  avgCardsForTeam: number;
  insight: string;
} | null {
  const matches = loadAllMatches();
  
  const refMatches = matches.filter(m => 
    m.referee.toLowerCase().includes(referee.toLowerCase()) &&
    (isTeamMatch(m.homeTeam, teamName) || isTeamMatch(m.awayTeam, teamName))
  );
  
  if (refMatches.length < 3) {
    return null;  // Not enough data
  }
  
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let totalCards = 0;
  
  for (const match of refMatches) {
    const isHome = isTeamMatch(match.homeTeam, teamName);
    
    if (isHome) {
      if (match.result === "H") wins++;
      else if (match.result === "D") draws++;
      else losses++;
      totalCards += match.homeYellow + match.homeRed * 2;
    } else {
      if (match.result === "A") wins++;
      else if (match.result === "D") draws++;
      else losses++;
      totalCards += match.awayYellow + match.awayRed * 2;
    }
  }
  
  const avgCards = totalCards / refMatches.length;
  const winRate = wins / refMatches.length;
  
  let insight: string;
  if (winRate > 0.6) {
    insight = `Good record with this referee (${wins}W-${draws}D-${losses}L)`;
  } else if (winRate < 0.3) {
    insight = `Poor record with this referee (${wins}W-${draws}D-${losses}L)`;
  } else {
    insight = `Neutral record with this referee`;
  }
  
  return {
    gamesRefereed: refMatches.length,
    teamWins: wins,
    teamDraws: draws,
    teamLosses: losses,
    avgCardsForTeam: avgCards,
    insight,
  };
}
