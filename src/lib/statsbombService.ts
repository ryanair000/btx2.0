/**
 * StatsBomb Open Data Service
 * Provides premium xG data and event-level analytics from StatsBomb open data
 */

import { promises as fs } from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data', 'statsbomb');

// Team name mappings between StatsBomb and our system
const TEAM_MAPPINGS: Record<string, string[]> = {
  'Arsenal': ['Arsenal'],
  'Aston Villa': ['Aston Villa'],
  'AFC Bournemouth': ['Bournemouth', 'AFC Bournemouth'],
  'Brighton & Hove Albion': ['Brighton', 'Brighton & Hove Albion'],
  'Burnley': ['Burnley'],
  'Chelsea': ['Chelsea'],
  'Crystal Palace': ['Crystal Palace'],
  'Everton': ['Everton'],
  'Fulham': ['Fulham'],
  'Leicester City': ['Leicester', 'Leicester City'],
  'Liverpool': ['Liverpool'],
  'Manchester City': ['Manchester City', 'Man City'],
  'Manchester United': ['Manchester United', 'Man United', 'Man Utd'],
  'Newcastle United': ['Newcastle', 'Newcastle United'],
  'Norwich City': ['Norwich', 'Norwich City'],
  'Southampton': ['Southampton'],
  'Stoke City': ['Stoke', 'Stoke City'],
  'Sunderland': ['Sunderland'],
  'Swansea City': ['Swansea', 'Swansea City'],
  'Tottenham Hotspur': ['Tottenham', 'Spurs', 'Tottenham Hotspur'],
  'Watford': ['Watford'],
  'West Bromwich Albion': ['West Brom', 'West Bromwich Albion'],
  'West Ham United': ['West Ham', 'West Ham United'],
  'Wolverhampton Wanderers': ['Wolves', 'Wolverhampton', 'Wolverhampton Wanderers'],
  'Leeds United': ['Leeds', 'Leeds United'],
  'Nottingham Forest': ['Nottingham Forest', "Nott'm Forest"],
  'Brentford': ['Brentford'],
  'Ipswich Town': ['Ipswich', 'Ipswich Town'],
  'Sheffield United': ['Sheffield United', 'Sheffield Utd'],
  'Luton Town': ['Luton', 'Luton Town'],
};

export interface ShotEvent {
  id: string;
  minute: number;
  second: number;
  player: string;
  team: string;
  xG: number;
  outcome: string;
  bodyPart: string;
  technique: string;
  location: [number, number];
  isGoal: boolean;
}

export interface MatchXGData {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeXG: number;
  awayXG: number;
  homeGoals: number;
  awayGoals: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  shots: ShotEvent[];
}

export interface TeamXGStats {
  team: string;
  matchesPlayed: number;
  totalXG: number;
  totalXGAgainst: number;
  avgXG: number;
  avgXGAgainst: number;
  shotsPerMatch: number;
  avgShotQuality: number; // xG per shot
  conversionRate: number; // goals / xG
  homeXG: number;
  awayXG: number;
  homeXGAgainst: number;
  awayXGAgainst: number;
}

export interface PlayerXGStats {
  player: string;
  team: string;
  totalXG: number;
  goals: number;
  shots: number;
  avgXGPerShot: number;
  conversionRate: number;
}

// Cache for loaded data
const cache: {
  competitions?: any[];
  matches?: Map<string, any[]>;
  events?: Map<string, any[]>;
  teamStats?: Map<string, TeamXGStats>;
  playerStats?: Map<string, PlayerXGStats>;
} = {};

/**
 * Load competitions list from StatsBomb data
 */
export async function loadCompetitions(): Promise<any[]> {
  if (cache.competitions) return cache.competitions;
  
  try {
    const filePath = path.join(DATA_PATH, 'competitions.json');
    const data = await fs.readFile(filePath, 'utf-8');
    cache.competitions = JSON.parse(data);
    return cache.competitions || [];
  } catch (error) {
    console.error('Error loading competitions:', error);
    return [];
  }
}

/**
 * Get available Premier League seasons
 */
export async function getPremierLeagueSeasons(): Promise<{seasonId: number; seasonName: string}[]> {
  const competitions = await loadCompetitions();
  return competitions
    .filter(c => c.competition_name === 'Premier League')
    .map(c => ({ seasonId: c.season_id, seasonName: c.season_name }));
}

/**
 * Load matches for a specific competition/season
 */
export async function loadMatches(competitionId: number, seasonId: number): Promise<any[]> {
  const key = `${competitionId}_${seasonId}`;
  if (cache.matches?.has(key)) return cache.matches.get(key)!;
  
  try {
    const filePath = path.join(DATA_PATH, 'matches', `${competitionId}`, `${seasonId}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    const matches = JSON.parse(data);
    
    if (!cache.matches) cache.matches = new Map();
    cache.matches.set(key, matches);
    
    return matches;
  } catch (error) {
    console.error(`Error loading matches for ${competitionId}/${seasonId}:`, error);
    return [];
  }
}

/**
 * Load events for a specific match
 */
export async function loadMatchEvents(matchId: number): Promise<any[]> {
  const key = String(matchId);
  if (cache.events?.has(key)) return cache.events.get(key)!;
  
  try {
    const filePath = path.join(DATA_PATH, 'events', `${matchId}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    const events = JSON.parse(data);
    
    if (!cache.events) cache.events = new Map();
    cache.events.set(key, events);
    
    return events;
  } catch (error) {
    // Many matches may not have events - that's okay
    return [];
  }
}

/**
 * Extract shots from match events
 */
export function extractShots(events: any[], homeTeam: string, awayTeam: string): ShotEvent[] {
  return events
    .filter(e => e.type?.name === 'Shot')
    .map(e => ({
      id: e.id,
      minute: e.minute || 0,
      second: e.second || 0,
      player: e.player?.name || 'Unknown',
      team: e.team?.name || 'Unknown',
      xG: e.shot?.statsbomb_xg || 0,
      outcome: e.shot?.outcome?.name || 'Unknown',
      bodyPart: e.shot?.body_part?.name || 'Unknown',
      technique: e.shot?.technique?.name || 'Unknown',
      location: e.location || [0, 0],
      isGoal: e.shot?.outcome?.name === 'Goal'
    }));
}

/**
 * Calculate xG data for a match
 */
export async function getMatchXGData(matchId: number): Promise<MatchXGData | null> {
  const events = await loadMatchEvents(matchId);
  if (events.length === 0) return null;
  
  // Get team info from events
  const teams = new Set<string>();
  events.forEach(e => {
    if (e.team?.name) teams.add(e.team.name);
  });
  
  const teamArray = Array.from(teams);
  if (teamArray.length !== 2) return null;
  
  // Determine home/away from event possession
  const firstEvent = events.find(e => e.period === 1 && e.minute === 0);
  const homeTeam = firstEvent?.team?.name || teamArray[0];
  const awayTeam = teamArray.find(t => t !== homeTeam) || teamArray[1];
  
  const shots = extractShots(events, homeTeam, awayTeam);
  
  const homeShots = shots.filter(s => s.team === homeTeam);
  const awayShots = shots.filter(s => s.team === awayTeam);
  
  return {
    matchId: String(matchId),
    homeTeam,
    awayTeam,
    homeXG: homeShots.reduce((sum, s) => sum + s.xG, 0),
    awayXG: awayShots.reduce((sum, s) => sum + s.xG, 0),
    homeGoals: homeShots.filter(s => s.isGoal).length,
    awayGoals: awayShots.filter(s => s.isGoal).length,
    homeShots: homeShots.length,
    awayShots: awayShots.length,
    homeShotsOnTarget: homeShots.filter(s => s.outcome === 'Goal' || s.outcome === 'Saved').length,
    awayShotsOnTarget: awayShots.filter(s => s.outcome === 'Goal' || s.outcome === 'Saved').length,
    shots
  };
}

/**
 * Normalize team name to match our system
 */
function normalizeTeamName(name: string): string {
  for (const [standard, variants] of Object.entries(TEAM_MAPPINGS)) {
    if (variants.some(v => v.toLowerCase() === name.toLowerCase())) {
      return standard;
    }
  }
  return name;
}

/**
 * Get all available match IDs from events folder
 */
export async function getAvailableMatchIds(): Promise<number[]> {
  try {
    const eventsPath = path.join(DATA_PATH, 'events');
    const files = await fs.readdir(eventsPath);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => parseInt(f.replace('.json', '')))
      .filter(id => !isNaN(id));
  } catch (error) {
    console.error('Error reading events directory:', error);
    return [];
  }
}

/**
 * Build team xG statistics from all available data
 */
export async function buildTeamXGStats(): Promise<Map<string, TeamXGStats>> {
  if (cache.teamStats) return cache.teamStats;
  
  const stats = new Map<string, TeamXGStats>();
  const matchIds = await getAvailableMatchIds();
  
  console.log(`Processing ${matchIds.length} matches for xG stats...`);
  
  // Process in batches to avoid memory issues
  const batchSize = 100;
  for (let i = 0; i < matchIds.length; i += batchSize) {
    const batch = matchIds.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (matchId) => {
      try {
        const matchData = await getMatchXGData(matchId);
        if (!matchData) return;
        
        // Update home team stats
        const homeTeam = normalizeTeamName(matchData.homeTeam);
        if (!stats.has(homeTeam)) {
          stats.set(homeTeam, createEmptyTeamStats(homeTeam));
        }
        updateTeamStats(stats.get(homeTeam)!, matchData, true);
        
        // Update away team stats
        const awayTeam = normalizeTeamName(matchData.awayTeam);
        if (!stats.has(awayTeam)) {
          stats.set(awayTeam, createEmptyTeamStats(awayTeam));
        }
        updateTeamStats(stats.get(awayTeam)!, matchData, false);
      } catch (error) {
        // Skip matches that fail to process
      }
    }));
  }
  
  // Finalize averages
  stats.forEach(teamStats => {
    if (teamStats.matchesPlayed > 0) {
      teamStats.avgXG = teamStats.totalXG / teamStats.matchesPlayed;
      teamStats.avgXGAgainst = teamStats.totalXGAgainst / teamStats.matchesPlayed;
      
      const homeMatches = teamStats.homeXG / (teamStats.avgXG || 1);
      const awayMatches = teamStats.awayXG / (teamStats.avgXG || 1);
      
      if (teamStats.shotsPerMatch > 0) {
        teamStats.avgShotQuality = teamStats.avgXG / teamStats.shotsPerMatch;
      }
    }
  });
  
  cache.teamStats = stats;
  return stats;
}

function createEmptyTeamStats(team: string): TeamXGStats {
  return {
    team,
    matchesPlayed: 0,
    totalXG: 0,
    totalXGAgainst: 0,
    avgXG: 0,
    avgXGAgainst: 0,
    shotsPerMatch: 0,
    avgShotQuality: 0,
    conversionRate: 0,
    homeXG: 0,
    awayXG: 0,
    homeXGAgainst: 0,
    awayXGAgainst: 0
  };
}

function updateTeamStats(stats: TeamXGStats, matchData: MatchXGData, isHome: boolean): void {
  stats.matchesPlayed++;
  
  if (isHome) {
    stats.totalXG += matchData.homeXG;
    stats.totalXGAgainst += matchData.awayXG;
    stats.homeXG += matchData.homeXG;
    stats.homeXGAgainst += matchData.awayXG;
    stats.shotsPerMatch = (stats.shotsPerMatch * (stats.matchesPlayed - 1) + matchData.homeShots) / stats.matchesPlayed;
    
    const goals = matchData.shots.filter(s => s.team === matchData.homeTeam && s.isGoal).length;
    stats.conversionRate = matchData.homeXG > 0 ? goals / matchData.homeXG : 0;
  } else {
    stats.totalXG += matchData.awayXG;
    stats.totalXGAgainst += matchData.homeXG;
    stats.awayXG += matchData.awayXG;
    stats.awayXGAgainst += matchData.homeXG;
    stats.shotsPerMatch = (stats.shotsPerMatch * (stats.matchesPlayed - 1) + matchData.awayShots) / stats.matchesPlayed;
    
    const goals = matchData.shots.filter(s => s.team === matchData.awayTeam && s.isGoal).length;
    stats.conversionRate = matchData.awayXG > 0 ? goals / matchData.awayXG : 0;
  }
}

/**
 * Get xG stats for a specific team
 */
export async function getTeamXGStats(teamName: string): Promise<TeamXGStats | null> {
  const stats = await buildTeamXGStats();
  const normalized = normalizeTeamName(teamName);
  return stats.get(normalized) || null;
}

/**
 * Calculate xG-based prediction factors
 */
export async function getXGPredictionFactors(homeTeam: string, awayTeam: string): Promise<{
  homeXGAdvantage: number;
  awayXGAdvantage: number;
  homeDefenseStrength: number;
  awayDefenseStrength: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  dataAvailable: boolean;
}> {
  const homeStats = await getTeamXGStats(homeTeam);
  const awayStats = await getTeamXGStats(awayTeam);
  
  if (!homeStats || !awayStats || homeStats.matchesPlayed < 5 || awayStats.matchesPlayed < 5) {
    return {
      homeXGAdvantage: 0,
      awayXGAdvantage: 0,
      homeDefenseStrength: 0,
      awayDefenseStrength: 0,
      expectedHomeGoals: 1.5,
      expectedAwayGoals: 1.2,
      dataAvailable: false
    };
  }
  
  // Calculate league averages
  const allStats = await buildTeamXGStats();
  let totalXG = 0;
  let totalXGA = 0;
  let totalMatches = 0;
  
  allStats.forEach(s => {
    totalXG += s.totalXG;
    totalXGA += s.totalXGAgainst;
    totalMatches += s.matchesPlayed;
  });
  
  const avgXG = totalXG / totalMatches;
  const avgXGA = totalXGA / totalMatches;
  
  // Calculate attack and defense strengths relative to average
  const homeAttackStrength = homeStats.avgXG / avgXG;
  const homeDefenseStrength = avgXGA / homeStats.avgXGAgainst; // Higher = better defense
  const awayAttackStrength = awayStats.avgXG / avgXG;
  const awayDefenseStrength = avgXGA / awayStats.avgXGAgainst;
  
  // Expected goals calculation
  const homeAdvantage = 1.1; // Home teams typically create ~10% more xG
  const expectedHomeGoals = homeStats.avgXG * homeAdvantage * (awayStats.avgXGAgainst / avgXGA);
  const expectedAwayGoals = awayStats.avgXG / homeAdvantage * (homeStats.avgXGAgainst / avgXGA);
  
  return {
    homeXGAdvantage: homeAttackStrength - 1,
    awayXGAdvantage: awayAttackStrength - 1,
    homeDefenseStrength: homeDefenseStrength - 1,
    awayDefenseStrength: awayDefenseStrength - 1,
    expectedHomeGoals: Math.round(expectedHomeGoals * 100) / 100,
    expectedAwayGoals: Math.round(expectedAwayGoals * 100) / 100,
    dataAvailable: true
  };
}

/**
 * Get player xG statistics
 */
export async function buildPlayerXGStats(): Promise<Map<string, PlayerXGStats>> {
  if (cache.playerStats) return cache.playerStats;
  
  const stats = new Map<string, PlayerXGStats>();
  const matchIds = await getAvailableMatchIds();
  
  for (const matchId of matchIds.slice(0, 500)) { // Limit for performance
    try {
      const events = await loadMatchEvents(matchId);
      const shots = events.filter(e => e.type?.name === 'Shot');
      
      for (const shot of shots) {
        const playerName = shot.player?.name;
        const team = shot.team?.name;
        const xG = shot.shot?.statsbomb_xg || 0;
        const isGoal = shot.shot?.outcome?.name === 'Goal';
        
        if (!playerName) continue;
        
        if (!stats.has(playerName)) {
          stats.set(playerName, {
            player: playerName,
            team: normalizeTeamName(team || 'Unknown'),
            totalXG: 0,
            goals: 0,
            shots: 0,
            avgXGPerShot: 0,
            conversionRate: 0
          });
        }
        
        const playerStats = stats.get(playerName)!;
        playerStats.totalXG += xG;
        playerStats.shots++;
        if (isGoal) playerStats.goals++;
        playerStats.avgXGPerShot = playerStats.totalXG / playerStats.shots;
        playerStats.conversionRate = playerStats.totalXG > 0 ? playerStats.goals / playerStats.totalXG : 0;
      }
    } catch (error) {
      // Skip matches that fail
    }
  }
  
  cache.playerStats = stats;
  return stats;
}

/**
 * Get shot pattern analysis for a team
 */
export async function getTeamShotPatterns(teamName: string): Promise<{
  avgShotDistance: number;
  headerPercentage: number;
  leftFootPercentage: number;
  rightFootPercentage: number;
  insideBoxPercentage: number;
  penaltyKicks: number;
  dataAvailable: boolean;
}> {
  const matchIds = await getAvailableMatchIds();
  const normalized = normalizeTeamName(teamName);
  
  const shots: ShotEvent[] = [];
  
  for (const matchId of matchIds.slice(0, 200)) {
    try {
      const events = await loadMatchEvents(matchId);
      const matchShots = extractShots(events, '', '');
      shots.push(...matchShots.filter(s => normalizeTeamName(s.team) === normalized));
    } catch (error) {
      // Skip failed matches
    }
  }
  
  if (shots.length < 10) {
    return {
      avgShotDistance: 0,
      headerPercentage: 0,
      leftFootPercentage: 0,
      rightFootPercentage: 0,
      insideBoxPercentage: 0,
      penaltyKicks: 0,
      dataAvailable: false
    };
  }
  
  const headers = shots.filter(s => s.bodyPart === 'Head').length;
  const leftFoot = shots.filter(s => s.bodyPart === 'Left Foot').length;
  const rightFoot = shots.filter(s => s.bodyPart === 'Right Foot').length;
  const insideBox = shots.filter(s => s.location[0] > 102).length; // x > 102 is inside box
  const penalties = shots.filter(s => s.technique === 'Penalty').length;
  
  // Calculate average shot distance (from goal at x=120)
  const avgDistance = shots.reduce((sum, s) => sum + Math.sqrt(Math.pow(120 - s.location[0], 2) + Math.pow(40 - s.location[1], 2)), 0) / shots.length;
  
  return {
    avgShotDistance: Math.round(avgDistance * 10) / 10,
    headerPercentage: Math.round(headers / shots.length * 100),
    leftFootPercentage: Math.round(leftFoot / shots.length * 100),
    rightFootPercentage: Math.round(rightFoot / shots.length * 100),
    insideBoxPercentage: Math.round(insideBox / shots.length * 100),
    penaltyKicks: penalties,
    dataAvailable: true
  };
}

// Export summary for quick access
export async function getStatsBombSummary(): Promise<{
  totalMatches: number;
  teamsAvailable: string[];
  competitions: string[];
  dataQuality: string;
}> {
  const competitions = await loadCompetitions();
  const matchIds = await getAvailableMatchIds();
  const teamStats = await buildTeamXGStats();
  
  return {
    totalMatches: matchIds.length,
    teamsAvailable: Array.from(teamStats.keys()).sort(),
    competitions: [...new Set(competitions.map(c => c.competition_name))],
    dataQuality: 'Premium (StatsBomb xG model)'
  };
}
