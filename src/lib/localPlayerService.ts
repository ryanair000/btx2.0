/**
 * Local Player Stats Service
 * Uses CSV data for player statistics
 * - players_current_season.csv (FPL API - xG, xA, injuries, form)
 * - players_24_25.csv (historical stats)
 * - players_23_24.csv (fallback)
 */

import fs from "fs";
import path from "path";

interface Player2324 {
  name: string;
  nation: string;
  position: string;
  age: number;
  matches: number;
  starts: number;
  minutes: number;
  nineties: number;
  goals: number;
  assists: number;
  xG: number;
  xAG: number;
  npxG: number;
  progCarries: number;
  progPasses: number;
  team: string;
}

interface Player2425 {
  name: string;
  club: string;
  nationality: string;
  position: string;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  conversionPct: number;
  bigChancesMissed: number;
  touches: number;
  passes: number;
  passSuccessPct: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  cleanSheets: number;
  goalsConceded: number;
  xGoTConceded: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  savesPct: number;
}

// NEW: FPL Current Season Player
interface PlayerFPL {
  name: string;
  fullName: string;
  team: string;
  position: string;
  price: number;
  totalPoints: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  goalsConceded: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  influence: number;
  creativity: number;
  threat: number;
  ictIndex: number;
  xG: number;
  xA: number;
  xGI: number;
  xGC: number;
  form: number;
  pointsPerGame: number;
  status: string; // a=available, i=injured, d=doubtful, s=suspended
  chanceOfPlaying: number | null;
  news: string;
}

export interface TeamPlayerStats {
  teamName: string;
  totalPlayers: number;
  totalGoals: number;
  totalAssists: number;
  totalXG: number;
  totalXAG: number;
  avgAge: number;
  keyPlayers: Array<{
    name: string;
    position: string;
    goals: number;
    assists: number;
    xG: number;
    minutes: number;
  }>;
  topScorer: { name: string; goals: number } | null;
  topAssister: { name: string; assists: number } | null;
  defensiveStrength: number; // Based on clean sheets and interceptions
  offensiveStrength: number; // Based on xG, shots, goals
}

// Team name mapping to normalize between datasets
const TEAM_NAME_MAP: Record<string, string[]> = {
  "Arsenal FC": ["Arsenal"],
  "Liverpool FC": ["Liverpool"],
  "Manchester City FC": ["Man City", "Manchester City"],
  "Manchester United FC": ["Man United", "Manchester United"],
  "Chelsea FC": ["Chelsea"],
  "Tottenham Hotspur FC": ["Tottenham", "Tottenham Hotspur", "Spurs"],
  "Newcastle United FC": ["Newcastle", "Newcastle United"],
  "West Ham United FC": ["West Ham", "West Ham United"],
  "Aston Villa FC": ["Aston Villa"],
  "Brighton & Hove Albion FC": ["Brighton", "Brighton & Hove Albion", "Brighton and Hove Albion"],
  "Fulham FC": ["Fulham"],
  "Brentford FC": ["Brentford"],
  "Crystal Palace FC": ["Crystal Palace"],
  "Wolverhampton Wanderers FC": ["Wolves", "Wolverhampton", "Wolverhampton Wanderers"],
  "AFC Bournemouth": ["Bournemouth", "AFC Bournemouth"],
  "Nottingham Forest FC": ["Nottingham Forest", "Nott'm Forest"],
  "Everton FC": ["Everton"],
  "Leicester City FC": ["Leicester", "Leicester City"],
  "Southampton FC": ["Southampton"],
  "Ipswich Town FC": ["Ipswich", "Ipswich Town"],
  "Leeds United FC": ["Leeds", "Leeds United"],
  "Burnley FC": ["Burnley"],
  "Luton Town FC": ["Luton", "Luton Town"],
  "Sheffield United FC": ["Sheffield United", "Sheffield Utd"],
};

let cachedPlayers2324: Player2324[] | null = null;
let cachedPlayers2425: Player2425[] | null = null;
let cachedPlayersFPL: PlayerFPL[] | null = null;

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

function loadPlayers2324(): Player2324[] {
  if (cachedPlayers2324) return cachedPlayers2324;

  const csvPath = path.join(process.cwd(), "data", "players_23_24.csv");
  if (!fs.existsSync(csvPath)) {
    console.warn("[Player Stats] players_23_24.csv not found");
    return [];
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n");
  const players: Player2324[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    if (fields.length < 34) continue;

    players.push({
      name: fields[0],
      nation: fields[1],
      position: fields[2],
      age: parseFloat(fields[3]) || 0,
      matches: parseInt(fields[4]) || 0,
      starts: parseInt(fields[5]) || 0,
      minutes: parseFloat(fields[6]) || 0,
      nineties: parseFloat(fields[7]) || 0,
      goals: parseFloat(fields[8]) || 0,
      assists: parseFloat(fields[9]) || 0,
      xG: parseFloat(fields[16]) || 0,
      xAG: parseFloat(fields[18]) || 0,
      npxG: parseFloat(fields[17]) || 0,
      progCarries: parseFloat(fields[20]) || 0,
      progPasses: parseFloat(fields[21]) || 0,
      team: fields[33],
    });
  }

  console.log(`[Player Stats] Loaded ${players.length} players from 23-24 season`);
  cachedPlayers2324 = players;
  return players;
}

function loadPlayers2425(): Player2425[] {
  if (cachedPlayers2425) return cachedPlayers2425;

  const csvPath = path.join(process.cwd(), "data", "players_24_25.csv");
  if (!fs.existsSync(csvPath)) {
    console.warn("[Player Stats] players_24_25.csv not found");
    return [];
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n");
  const players: Player2425[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    if (fields.length < 50) continue;

    players.push({
      name: fields[0],
      club: fields[1],
      nationality: fields[2],
      position: fields[3],
      appearances: parseInt(fields[4]) || 0,
      minutes: parseInt(fields[5]) || 0,
      goals: parseInt(fields[6]) || 0,
      assists: parseInt(fields[7]) || 0,
      shots: parseInt(fields[8]) || 0,
      shotsOnTarget: parseInt(fields[9]) || 0,
      conversionPct: parseFloat(fields[10]?.replace("%", "")) || 0,
      bigChancesMissed: parseInt(fields[11]) || 0,
      touches: parseInt(fields[14]) || 0,
      passes: parseInt(fields[15]) || 0,
      passSuccessPct: parseFloat(fields[17]?.replace("%", "")) || 0,
      tackles: parseInt(fields[38]) || 0,
      interceptions: parseInt(fields[36]) || 0,
      clearances: parseInt(fields[35]) || 0,
      cleanSheets: parseInt(fields[34]) || 0,
      goalsConceded: parseInt(fields[44]) || 0,
      xGoTConceded: parseFloat(fields[45]) || 0,
      yellowCards: parseInt(fields[48]) || 0,
      redCards: parseInt(fields[49]) || 0,
      saves: parseInt(fields[50]) || 0,
      savesPct: parseFloat(fields[51]?.replace("%", "")) || 0,
    });
  }

  console.log(`[Player Stats] Loaded ${players.length} players from 24-25 season`);
  cachedPlayers2425 = players;
  return players;
}

/**
 * Load current season players from FPL data
 * Best source: includes xG, xA, injuries, form
 */
function loadPlayersFPL(): PlayerFPL[] {
  if (cachedPlayersFPL) return cachedPlayersFPL;

  const csvPath = path.join(process.cwd(), "data", "players_current_season.csv");
  if (!fs.existsSync(csvPath)) {
    console.warn("[Player Stats] players_current_season.csv not found - run scrape_fpl.py");
    return [];
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n");
  const players: PlayerFPL[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    if (fields.length < 30) continue;

    players.push({
      name: fields[0],
      fullName: fields[1],
      team: fields[2],
      position: fields[3],
      price: parseFloat(fields[4]) || 0,
      totalPoints: parseInt(fields[5]) || 0,
      minutes: parseInt(fields[6]) || 0,
      goals: parseInt(fields[7]) || 0,
      assists: parseInt(fields[8]) || 0,
      cleanSheets: parseInt(fields[9]) || 0,
      goalsConceded: parseInt(fields[10]) || 0,
      yellowCards: parseInt(fields[14]) || 0,
      redCards: parseInt(fields[15]) || 0,
      saves: parseInt(fields[16]) || 0,
      influence: parseFloat(fields[18]) || 0,
      creativity: parseFloat(fields[19]) || 0,
      threat: parseFloat(fields[20]) || 0,
      ictIndex: parseFloat(fields[21]) || 0,
      xG: parseFloat(fields[22]) || 0,
      xA: parseFloat(fields[23]) || 0,
      xGI: parseFloat(fields[24]) || 0,
      xGC: parseFloat(fields[25]) || 0,
      form: parseFloat(fields[26]) || 0,
      pointsPerGame: parseFloat(fields[27]) || 0,
      status: fields[29] || "a",
      chanceOfPlaying: fields[30] ? parseInt(fields[30]) : null,
      news: fields[31] || "",
    });
  }

  console.log(`[Player Stats] Loaded ${players.length} players from current season (FPL)`);
  cachedPlayersFPL = players;
  return players;
}

function normalizeTeamName(teamName: string): string[] {
  const mapped = TEAM_NAME_MAP[teamName];
  if (mapped) return mapped;
  
  return [
    teamName,
    teamName.replace(" FC", ""),
    teamName.replace(" AFC", ""),
  ];
}

function teamMatches(csvTeam: string, searchTeam: string): boolean {
  const variants = normalizeTeamName(searchTeam);
  const csvLower = csvTeam.toLowerCase().trim();
  
  return variants.some(v => 
    csvLower === v.toLowerCase() ||
    csvLower.includes(v.toLowerCase())
  );
}

/**
 * Get team player statistics for current season (24-25)
 */
export function getTeamPlayerStats(teamName: string): TeamPlayerStats | null {
  const players2425 = loadPlayers2425();
  const teamPlayers = players2425.filter(p => teamMatches(p.club, teamName));

  if (teamPlayers.length === 0) {
    // Try 23-24 data as fallback
    const players2324 = loadPlayers2324();
    const teamPlayers2324 = players2324.filter(p => teamMatches(p.team, teamName));
    
    if (teamPlayers2324.length === 0) {
      console.log(`[Player Stats] No players found for ${teamName}`);
      return null;
    }

    // Use 23-24 data
    const totalGoals = teamPlayers2324.reduce((sum, p) => sum + p.goals, 0);
    const totalAssists = teamPlayers2324.reduce((sum, p) => sum + p.assists, 0);
    const totalXG = teamPlayers2324.reduce((sum, p) => sum + p.xG, 0);
    const totalXAG = teamPlayers2324.reduce((sum, p) => sum + p.xAG, 0);
    const avgAge = teamPlayers2324.reduce((sum, p) => sum + p.age, 0) / teamPlayers2324.length;

    const topScorer = teamPlayers2324.reduce((max, p) => 
      p.goals > (max?.goals || 0) ? { name: p.name, goals: p.goals } : max, 
      null as { name: string; goals: number } | null
    );

    const topAssister = teamPlayers2324.reduce((max, p) => 
      p.assists > (max?.assists || 0) ? { name: p.name, assists: p.assists } : max,
      null as { name: string; assists: number } | null
    );

    const keyPlayers = teamPlayers2324
      .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        position: p.position,
        goals: p.goals,
        assists: p.assists,
        xG: p.xG,
        minutes: p.minutes,
      }));

    return {
      teamName,
      totalPlayers: teamPlayers2324.length,
      totalGoals,
      totalAssists,
      totalXG,
      totalXAG,
      avgAge,
      keyPlayers,
      topScorer,
      topAssister,
      defensiveStrength: 50, // Default for 23-24 data
      offensiveStrength: Math.min(100, (totalXG / teamPlayers2324.length) * 20),
    };
  }

  // Use 24-25 data
  const totalGoals = teamPlayers.reduce((sum, p) => sum + p.goals, 0);
  const totalAssists = teamPlayers.reduce((sum, p) => sum + p.assists, 0);
  const totalCleanSheets = teamPlayers.filter(p => p.position === "GKP" || p.position === "DEF")
    .reduce((sum, p) => sum + p.cleanSheets, 0);
  const totalInterceptions = teamPlayers.reduce((sum, p) => sum + p.interceptions, 0);
  const totalShots = teamPlayers.reduce((sum, p) => sum + p.shots, 0);

  const topScorer = teamPlayers.reduce((max, p) => 
    p.goals > (max?.goals || 0) ? { name: p.name, goals: p.goals } : max,
    null as { name: string; goals: number } | null
  );

  const topAssister = teamPlayers.reduce((max, p) => 
    p.assists > (max?.assists || 0) ? { name: p.name, assists: p.assists } : max,
    null as { name: string; assists: number } | null
  );

  const keyPlayers = teamPlayers
    .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))
    .slice(0, 5)
    .map(p => ({
      name: p.name,
      position: p.position,
      goals: p.goals,
      assists: p.assists,
      xG: 0, // Not in 24-25 data
      minutes: p.minutes,
    }));

  // Calculate strengths (0-100 scale)
  const defensiveStrength = Math.min(100, (totalCleanSheets * 5) + (totalInterceptions * 0.5));
  const offensiveStrength = Math.min(100, (totalGoals * 3) + (totalShots * 0.2));

  return {
    teamName,
    totalPlayers: teamPlayers.length,
    totalGoals,
    totalAssists,
    totalXG: 0, // Not in 24-25 data
    totalXAG: 0,
    avgAge: 0,
    keyPlayers,
    topScorer,
    topAssister,
    defensiveStrength,
    offensiveStrength,
  };
}

/**
 * Get key player availability impact
 * Returns a modifier based on missing key players
 */
export function getPlayerImpactModifier(
  teamName: string,
  unavailablePlayers: string[]
): number {
  const stats = getTeamPlayerStats(teamName);
  if (!stats) return 1.0;

  let impactReduction = 0;

  for (const unavailable of unavailablePlayers) {
    const keyPlayer = stats.keyPlayers.find(
      p => p.name.toLowerCase().includes(unavailable.toLowerCase())
    );

    if (keyPlayer) {
      // Key player missing - calculate impact based on their contribution
      const contribution = (keyPlayer.goals + keyPlayer.assists) / 
        Math.max(1, stats.totalGoals + stats.totalAssists);
      impactReduction += contribution * 0.5; // 50% of their contribution as impact
    }

    // Check if top scorer is missing
    if (stats.topScorer?.name.toLowerCase().includes(unavailable.toLowerCase())) {
      impactReduction += 0.15;
    }
  }

  // Cap the reduction at 30%
  return Math.max(0.7, 1 - impactReduction);
}

/**
 * Compare two teams' player quality
 * Returns positive if home team is stronger, negative if away
 */
export function compareTeamQuality(
  homeTeam: string,
  awayTeam: string
): { homeAdvantage: number; insight: string } {
  const homeStats = getTeamPlayerStats(homeTeam);
  const awayStats = getTeamPlayerStats(awayTeam);

  if (!homeStats || !awayStats) {
    return { homeAdvantage: 0, insight: "Insufficient player data" };
  }

  const homeScore = homeStats.offensiveStrength + homeStats.defensiveStrength;
  const awayScore = awayStats.offensiveStrength + awayStats.defensiveStrength;

  const difference = homeScore - awayScore;
  const normalizedAdvantage = Math.max(-20, Math.min(20, difference / 5));

  let insight = "";
  if (homeStats.topScorer && awayStats.topScorer) {
    if (homeStats.topScorer.goals > awayStats.topScorer.goals) {
      insight = `${homeStats.topScorer.name} (${homeStats.topScorer.goals}G) leads scoring`;
    } else {
      insight = `${awayStats.topScorer.name} (${awayStats.topScorer.goals}G) leads scoring`;
    }
  }

  return { homeAdvantage: normalizedAdvantage, insight };
}

// ============= NEW: FPL-BASED FUNCTIONS =============

export interface TeamXGStats {
  teamName: string;
  totalXG: number;
  totalXA: number;
  totalXGC: number;  // xG conceded
  avgForm: number;
  avgICT: number;
  topThreat: { name: string; threat: number } | null;
  topCreator: { name: string; creativity: number } | null;
}

export interface InjuredPlayer {
  name: string;
  position: string;
  status: string;
  chanceOfPlaying: number | null;
  news: string;
  impact: "high" | "medium" | "low";
}

export interface TeamAvailability {
  teamName: string;
  injuredPlayers: InjuredPlayer[];
  suspendedPlayers: InjuredPlayer[];
  doubtfulPlayers: InjuredPlayer[];
  availabilityScore: number; // 0-100, 100 = full squad
  impactSummary: string;
}

/**
 * Get team xG stats from FPL data
 */
export function getTeamXGStats(teamName: string): TeamXGStats | null {
  const players = loadPlayersFPL();
  const teamPlayers = players.filter(p => teamMatches(p.team, teamName));

  if (teamPlayers.length === 0) {
    console.log(`[Player Stats] No FPL data for ${teamName}`);
    return null;
  }

  const totalXG = teamPlayers.reduce((sum, p) => sum + p.xG, 0);
  const totalXA = teamPlayers.reduce((sum, p) => sum + p.xA, 0);
  const totalXGC = teamPlayers.filter(p => p.position === "GK" || p.position === "DEF")
    .reduce((sum, p) => sum + p.xGC, 0);
  
  const avgForm = teamPlayers.filter(p => p.minutes > 90)
    .reduce((sum, p, _, arr) => sum + p.form / arr.length, 0);
  
  const avgICT = teamPlayers.filter(p => p.minutes > 90)
    .reduce((sum, p, _, arr) => sum + p.ictIndex / arr.length, 0);

  const topThreat = teamPlayers.reduce((max, p) => 
    p.threat > (max?.threat || 0) ? { name: p.name, threat: p.threat } : max,
    null as { name: string; threat: number } | null
  );

  const topCreator = teamPlayers.reduce((max, p) => 
    p.creativity > (max?.creativity || 0) ? { name: p.name, creativity: p.creativity } : max,
    null as { name: string; creativity: number } | null
  );

  return {
    teamName,
    totalXG,
    totalXA,
    totalXGC,
    avgForm,
    avgICT,
    topThreat,
    topCreator,
  };
}

/**
 * Get injured/suspended/doubtful players for a team
 */
export function getTeamAvailability(teamName: string): TeamAvailability {
  const players = loadPlayersFPL();
  const teamPlayers = players.filter(p => teamMatches(p.team, teamName));

  const getImpact = (player: PlayerFPL): "high" | "medium" | "low" => {
    // High impact: top players (high ICT, many minutes)
    if (player.ictIndex > 100 || player.totalPoints > 80) return "high";
    if (player.minutes > 1000 || player.goals > 3 || player.assists > 3) return "medium";
    return "low";
  };

  const injured = teamPlayers
    .filter(p => p.status === "i")
    .map(p => ({
      name: p.name,
      position: p.position,
      status: "injured",
      chanceOfPlaying: p.chanceOfPlaying,
      news: p.news,
      impact: getImpact(p),
    }));

  const suspended = teamPlayers
    .filter(p => p.status === "s")
    .map(p => ({
      name: p.name,
      position: p.position,
      status: "suspended",
      chanceOfPlaying: 0,
      news: p.news,
      impact: getImpact(p),
    }));

  const doubtful = teamPlayers
    .filter(p => p.status === "d")
    .map(p => ({
      name: p.name,
      position: p.position,
      status: "doubtful",
      chanceOfPlaying: p.chanceOfPlaying,
      news: p.news,
      impact: getImpact(p),
    }));

  // Calculate availability score
  const totalImpact = [...injured, ...suspended, ...doubtful].reduce((sum, p) => {
    if (p.impact === "high") return sum + 15;
    if (p.impact === "medium") return sum + 8;
    return sum + 3;
  }, 0);

  const availabilityScore = Math.max(0, 100 - totalImpact);

  // Generate summary
  const highImpactMissing = [...injured, ...suspended].filter(p => p.impact === "high");
  let impactSummary = "";
  
  if (highImpactMissing.length > 0) {
    impactSummary = `Missing key players: ${highImpactMissing.map(p => p.name).join(", ")}`;
  } else if (injured.length + suspended.length > 3) {
    impactSummary = `${injured.length + suspended.length} players unavailable`;
  } else if (availabilityScore >= 90) {
    impactSummary = "Near full strength";
  } else {
    impactSummary = "Minor availability concerns";
  }

  return {
    teamName,
    injuredPlayers: injured,
    suspendedPlayers: suspended,
    doubtfulPlayers: doubtful,
    availabilityScore,
    impactSummary,
  };
}

/**
 * Compare two teams' xG and availability for prediction
 */
export function compareTeamsForPrediction(
  homeTeam: string,
  awayTeam: string
): {
  xgAdvantage: number;  // Positive = home advantage
  availabilityAdvantage: number;
  homeXG: TeamXGStats | null;
  awayXG: TeamXGStats | null;
  homeAvailability: TeamAvailability;
  awayAvailability: TeamAvailability;
  insight: string;
} {
  const homeXG = getTeamXGStats(homeTeam);
  const awayXG = getTeamXGStats(awayTeam);
  const homeAvailability = getTeamAvailability(homeTeam);
  const awayAvailability = getTeamAvailability(awayTeam);

  // xG advantage calculation
  let xgAdvantage = 0;
  if (homeXG && awayXG) {
    const homeOffensive = homeXG.totalXG + homeXG.totalXA;
    const awayOffensive = awayXG.totalXG + awayXG.totalXA;
    const homeDefensive = 100 - (homeXG.totalXGC * 2);  // Lower is better
    const awayDefensive = 100 - (awayXG.totalXGC * 2);
    
    xgAdvantage = ((homeOffensive - awayOffensive) * 0.5) + ((homeDefensive - awayDefensive) * 0.3);
  }

  // Availability advantage
  const availabilityAdvantage = (homeAvailability.availabilityScore - awayAvailability.availabilityScore) / 10;

  // Generate insight
  const insights: string[] = [];
  
  if (homeXG && awayXG) {
    if (homeXG.totalXG > awayXG.totalXG * 1.3) {
      insights.push(`${homeTeam} has superior attacking xG`);
    } else if (awayXG.totalXG > homeXG.totalXG * 1.3) {
      insights.push(`${awayTeam} has superior attacking xG`);
    }
  }

  if (homeAvailability.availabilityScore < 70) {
    insights.push(`${homeTeam} has significant absences`);
  }
  if (awayAvailability.availabilityScore < 70) {
    insights.push(`${awayTeam} has significant absences`);
  }

  return {
    xgAdvantage: Math.max(-15, Math.min(15, xgAdvantage)),
    availabilityAdvantage: Math.max(-10, Math.min(10, availabilityAdvantage)),
    homeXG,
    awayXG,
    homeAvailability,
    awayAvailability,
    insight: insights.join(". ") || "Both teams relatively even",
  };
}
