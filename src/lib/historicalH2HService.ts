/**
 * Historical H2H Analysis Service
 * Uses 30+ years of Premier League data for deep head-to-head analysis
 */

import { promises as fs } from 'fs';
import path from 'path';
import Papa from 'papaparse';

const DATA_PATH = path.join(process.cwd(), 'data');

interface HistoricalMatch {
  date: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  result: 'H' | 'D' | 'A';
  homeShots?: number;
  awayShots?: number;
  homeCorners?: number;
  awayCorners?: number;
}

interface H2HStats {
  totalMatches: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  homeGoals: number;
  awayGoals: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  avgTotalGoals: number;
  homeWinPercentage: number;
  awayWinPercentage: number;
  drawPercentage: number;
  recentForm: string; // Last 6 matches: W/D/L from home team perspective
  lastMeeting?: HistoricalMatch;
  over25Percentage: number;
  bttsPercentage: number; // Both teams to score
}

interface VenueStats {
  team: string;
  venue: 'home' | 'away';
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  winPercentage: number;
}

interface SeasonStats {
  season: string;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  ppg: number; // Points per game
}

// Team name normalization
const TEAM_ALIASES: Record<string, string[]> = {
  'Arsenal': ['Arsenal'],
  'Aston Villa': ['Aston Villa'],
  'Birmingham': ['Birmingham', 'Birmingham City'],
  'Blackburn': ['Blackburn', 'Blackburn Rovers'],
  'Blackpool': ['Blackpool'],
  'Bolton': ['Bolton', 'Bolton Wanderers'],
  'Bournemouth': ['Bournemouth', 'AFC Bournemouth'],
  'Bradford': ['Bradford', 'Bradford City'],
  'Brentford': ['Brentford'],
  'Brighton': ['Brighton', 'Brighton & Hove Albion'],
  'Burnley': ['Burnley'],
  'Cardiff': ['Cardiff', 'Cardiff City'],
  'Charlton': ['Charlton', 'Charlton Athletic'],
  'Chelsea': ['Chelsea'],
  'Coventry': ['Coventry', 'Coventry City'],
  'Crystal Palace': ['Crystal Palace'],
  'Derby': ['Derby', 'Derby County'],
  'Everton': ['Everton'],
  'Fulham': ['Fulham'],
  'Huddersfield': ['Huddersfield', 'Huddersfield Town'],
  'Hull': ['Hull', 'Hull City'],
  'Ipswich': ['Ipswich', 'Ipswich Town'],
  'Leeds': ['Leeds', 'Leeds United'],
  'Leicester': ['Leicester', 'Leicester City'],
  'Liverpool': ['Liverpool'],
  'Man City': ['Man City', 'Manchester City'],
  'Man United': ['Man United', 'Manchester United', 'Man Utd'],
  'Middlesbrough': ['Middlesbrough', 'Middlesboro'],
  'Newcastle': ['Newcastle', 'Newcastle United'],
  'Norwich': ['Norwich', 'Norwich City'],
  'Nottingham Forest': ['Nottingham Forest', "Nott'm Forest", 'Forest'],
  'Oldham': ['Oldham', 'Oldham Athletic'],
  'Portsmouth': ['Portsmouth'],
  'QPR': ['QPR', 'Queens Park Rangers'],
  'Reading': ['Reading'],
  'Sheffield United': ['Sheffield United', 'Sheff Utd', 'Sheffield Utd'],
  'Sheffield Weds': ['Sheffield Weds', 'Sheffield Wednesday'],
  'Southampton': ['Southampton'],
  'Stoke': ['Stoke', 'Stoke City'],
  'Sunderland': ['Sunderland'],
  'Swansea': ['Swansea', 'Swansea City'],
  'Tottenham': ['Tottenham', 'Tottenham Hotspur', 'Spurs'],
  'Watford': ['Watford'],
  'West Brom': ['West Brom', 'West Bromwich Albion', 'WBA'],
  'West Ham': ['West Ham', 'West Ham United'],
  'Wigan': ['Wigan', 'Wigan Athletic'],
  'Wimbledon': ['Wimbledon'],
  'Wolves': ['Wolves', 'Wolverhampton', 'Wolverhampton Wanderers'],
  'Luton': ['Luton', 'Luton Town'],
};

// Cache
let historicalData: HistoricalMatch[] | null = null;

/**
 * Normalize team name to standard format
 */
function normalizeTeamName(name: string): string {
  const lowerName = name.toLowerCase().trim();
  for (const [standard, aliases] of Object.entries(TEAM_ALIASES)) {
    if (aliases.some(a => a.toLowerCase() === lowerName)) {
      return standard;
    }
  }
  return name;
}

/**
 * Load all historical Premier League data
 */
export async function loadHistoricalData(): Promise<HistoricalMatch[]> {
  if (historicalData) return historicalData;
  
  const matches: HistoricalMatch[] = [];
  
  try {
    // Load main historical file
    const plPath = path.join(DATA_PATH, 'PremierLeague.csv');
    const plData = await fs.readFile(plPath, 'utf-8');
    
    const parsed = Papa.parse(plData, { header: true, skipEmptyLines: true });
    
    for (const row of parsed.data as any[]) {
      if (!row.HomeTeam || !row.AwayTeam) continue;
      
      const homeGoals = parseInt(row.FTHG) || 0;
      const awayGoals = parseInt(row.FTAG) || 0;
      
      matches.push({
        date: row.Date || '',
        season: row.Season || '',
        homeTeam: normalizeTeamName(row.HomeTeam),
        awayTeam: normalizeTeamName(row.AwayTeam),
        homeGoals,
        awayGoals,
        result: row.FTR === 'H' ? 'H' : row.FTR === 'A' ? 'A' : 'D',
        homeShots: parseInt(row.HS) || undefined,
        awayShots: parseInt(row.AS) || undefined,
        homeCorners: parseInt(row.HC) || undefined,
        awayCorners: parseInt(row.AC) || undefined
      });
    }
    
    // Also load individual season files for more recent data
    const seasonFiles = ['epl_2021.csv', 'epl_2122.csv', 'epl_2223.csv', 'epl_2324.csv', 'epl_2425.csv'];
    
    for (const file of seasonFiles) {
      try {
        const filePath = path.join(DATA_PATH, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const parsed = Papa.parse(data, { header: true, skipEmptyLines: true });
        
        const season = file.replace('epl_', '').replace('.csv', '');
        
        for (const row of parsed.data as any[]) {
          if (!row.HomeTeam || !row.AwayTeam) continue;
          
          const homeGoals = parseInt(row.FTHG) || 0;
          const awayGoals = parseInt(row.FTAG) || 0;
          
          // Avoid duplicates
          const exists = matches.some(m => 
            m.homeTeam === normalizeTeamName(row.HomeTeam) &&
            m.awayTeam === normalizeTeamName(row.AwayTeam) &&
            m.date === row.Date
          );
          
          if (!exists) {
            matches.push({
              date: row.Date || '',
              season,
              homeTeam: normalizeTeamName(row.HomeTeam),
              awayTeam: normalizeTeamName(row.AwayTeam),
              homeGoals,
              awayGoals,
              result: row.FTR === 'H' ? 'H' : row.FTR === 'A' ? 'A' : 'D',
              homeShots: parseInt(row.HS) || undefined,
              awayShots: parseInt(row.AS) || undefined,
              homeCorners: parseInt(row.HC) || undefined,
              awayCorners: parseInt(row.AC) || undefined
            });
          }
        }
      } catch (error) {
        // File might not exist
      }
    }
    
    // Sort by date descending
    matches.sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      return dateB.getTime() - dateA.getTime();
    });
    
    historicalData = matches;
    console.log(`Loaded ${matches.length} historical matches`);
    return matches;
  } catch (error) {
    console.error('Error loading historical data:', error);
    return [];
  }
}

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  
  // Try different formats
  // DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const fullYear = year.length === 2 ? (parseInt(year) > 50 ? `19${year}` : `20${year}`) : year;
    return new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }
  
  // Try ISO format
  return new Date(dateStr);
}

/**
 * Get head-to-head statistics between two teams
 */
export async function getH2HStats(team1: string, team2: string): Promise<H2HStats | null> {
  const matches = await loadHistoricalData();
  
  const t1 = normalizeTeamName(team1);
  const t2 = normalizeTeamName(team2);
  
  // Find all matches between these teams
  const h2hMatches = matches.filter(m => 
    (m.homeTeam === t1 && m.awayTeam === t2) ||
    (m.homeTeam === t2 && m.awayTeam === t1)
  );
  
  if (h2hMatches.length === 0) {
    return null;
  }
  
  // Stats from team1's perspective when they are home
  const team1HomeMatches = h2hMatches.filter(m => m.homeTeam === t1);
  const team1AwayMatches = h2hMatches.filter(m => m.awayTeam === t1);
  
  let team1Wins = 0;
  let team2Wins = 0;
  let draws = 0;
  let team1Goals = 0;
  let team2Goals = 0;
  let over25Count = 0;
  let bttsCount = 0;
  
  for (const match of h2hMatches) {
    const team1IsHome = match.homeTeam === t1;
    const t1GoalsThisMatch = team1IsHome ? match.homeGoals : match.awayGoals;
    const t2GoalsThisMatch = team1IsHome ? match.awayGoals : match.homeGoals;
    
    team1Goals += t1GoalsThisMatch;
    team2Goals += t2GoalsThisMatch;
    
    if (t1GoalsThisMatch > t2GoalsThisMatch) team1Wins++;
    else if (t2GoalsThisMatch > t1GoalsThisMatch) team2Wins++;
    else draws++;
    
    if (match.homeGoals + match.awayGoals > 2.5) over25Count++;
    if (match.homeGoals > 0 && match.awayGoals > 0) bttsCount++;
  }
  
  // Recent form (last 6 matches from team1 perspective)
  const recentMatches = h2hMatches.slice(0, 6);
  const formString = recentMatches.map(m => {
    const t1IsHome = m.homeTeam === t1;
    const t1GoalsMatch = t1IsHome ? m.homeGoals : m.awayGoals;
    const t2GoalsMatch = t1IsHome ? m.awayGoals : m.homeGoals;
    
    if (t1GoalsMatch > t2GoalsMatch) return 'W';
    if (t2GoalsMatch > t1GoalsMatch) return 'L';
    return 'D';
  }).join('');
  
  return {
    totalMatches: h2hMatches.length,
    homeWins: team1Wins,
    awayWins: team2Wins,
    draws,
    homeGoals: team1Goals,
    awayGoals: team2Goals,
    avgHomeGoals: Math.round((team1Goals / h2hMatches.length) * 100) / 100,
    avgAwayGoals: Math.round((team2Goals / h2hMatches.length) * 100) / 100,
    avgTotalGoals: Math.round(((team1Goals + team2Goals) / h2hMatches.length) * 100) / 100,
    homeWinPercentage: Math.round((team1Wins / h2hMatches.length) * 100),
    awayWinPercentage: Math.round((team2Wins / h2hMatches.length) * 100),
    drawPercentage: Math.round((draws / h2hMatches.length) * 100),
    recentForm: formString,
    lastMeeting: h2hMatches[0],
    over25Percentage: Math.round((over25Count / h2hMatches.length) * 100),
    bttsPercentage: Math.round((bttsCount / h2hMatches.length) * 100)
  };
}

/**
 * Get venue-specific statistics for a team
 */
export async function getVenueStats(teamName: string, venue: 'home' | 'away'): Promise<VenueStats | null> {
  const matches = await loadHistoricalData();
  const team = normalizeTeamName(teamName);
  
  const teamMatches = venue === 'home'
    ? matches.filter(m => m.homeTeam === team)
    : matches.filter(m => m.awayTeam === team);
  
  if (teamMatches.length === 0) return null;
  
  let wins = 0, draws = 0, losses = 0;
  let goalsFor = 0, goalsAgainst = 0, cleanSheets = 0;
  
  for (const match of teamMatches) {
    const gf = venue === 'home' ? match.homeGoals : match.awayGoals;
    const ga = venue === 'home' ? match.awayGoals : match.homeGoals;
    
    goalsFor += gf;
    goalsAgainst += ga;
    
    if (gf > ga) wins++;
    else if (gf < ga) losses++;
    else draws++;
    
    if (ga === 0) cleanSheets++;
  }
  
  return {
    team,
    venue,
    matchesPlayed: teamMatches.length,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    cleanSheets,
    avgGoalsFor: Math.round((goalsFor / teamMatches.length) * 100) / 100,
    avgGoalsAgainst: Math.round((goalsAgainst / teamMatches.length) * 100) / 100,
    winPercentage: Math.round((wins / teamMatches.length) * 100)
  };
}

/**
 * Get season-by-season statistics for a team
 */
export async function getSeasonHistory(teamName: string): Promise<SeasonStats[]> {
  const matches = await loadHistoricalData();
  const team = normalizeTeamName(teamName);
  
  const seasonMap = new Map<string, SeasonStats>();
  
  for (const match of matches) {
    if (match.homeTeam !== team && match.awayTeam !== team) continue;
    
    const season = match.season || 'Unknown';
    
    if (!seasonMap.has(season)) {
      seasonMap.set(season, {
        season,
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        ppg: 0
      });
    }
    
    const stats = seasonMap.get(season)!;
    stats.played++;
    
    const isHome = match.homeTeam === team;
    const gf = isHome ? match.homeGoals : match.awayGoals;
    const ga = isHome ? match.awayGoals : match.homeGoals;
    
    stats.goalsFor += gf;
    stats.goalsAgainst += ga;
    
    if (gf > ga) {
      stats.won++;
      stats.points += 3;
    } else if (gf < ga) {
      stats.lost++;
    } else {
      stats.drawn++;
      stats.points += 1;
    }
    
    stats.ppg = Math.round((stats.points / stats.played) * 100) / 100;
  }
  
  return Array.from(seasonMap.values()).sort((a, b) => {
    // Sort by season descending
    return b.season.localeCompare(a.season);
  });
}

/**
 * Get recent form for a team (all matches)
 */
export async function getRecentForm(teamName: string, numMatches: number = 10): Promise<{
  form: string;
  results: HistoricalMatch[];
  winPercentage: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
}> {
  const matches = await loadHistoricalData();
  const team = normalizeTeamName(teamName);
  
  const teamMatches = matches
    .filter(m => m.homeTeam === team || m.awayTeam === team)
    .slice(0, numMatches);
  
  let wins = 0, goalsFor = 0, goalsAgainst = 0;
  
  const formChars = teamMatches.map(m => {
    const isHome = m.homeTeam === team;
    const gf = isHome ? m.homeGoals : m.awayGoals;
    const ga = isHome ? m.awayGoals : m.homeGoals;
    
    goalsFor += gf;
    goalsAgainst += ga;
    
    if (gf > ga) { wins++; return 'W'; }
    if (gf < ga) return 'L';
    return 'D';
  });
  
  return {
    form: formChars.join(''),
    results: teamMatches,
    winPercentage: teamMatches.length > 0 ? Math.round((wins / teamMatches.length) * 100) : 0,
    avgGoalsFor: teamMatches.length > 0 ? Math.round((goalsFor / teamMatches.length) * 100) / 100 : 0,
    avgGoalsAgainst: teamMatches.length > 0 ? Math.round((goalsAgainst / teamMatches.length) * 100) / 100 : 0
  };
}

/**
 * Calculate historical prediction factors
 */
export async function getHistoricalPredictionFactors(homeTeam: string, awayTeam: string): Promise<{
  h2hAdvantage: number; // Positive = home team advantage
  homeVenueStrength: number;
  awayFormStrength: number;
  historicalOver25: number;
  historicalBTTS: number;
  dataPoints: number;
  recommendation: string;
}> {
  const h2h = await getH2HStats(homeTeam, awayTeam);
  const homeVenue = await getVenueStats(homeTeam, 'home');
  const awayVenue = await getVenueStats(awayTeam, 'away');
  
  if (!h2h && !homeVenue && !awayVenue) {
    return {
      h2hAdvantage: 0,
      homeVenueStrength: 0,
      awayFormStrength: 0,
      historicalOver25: 55, // League average
      historicalBTTS: 50,
      dataPoints: 0,
      recommendation: 'Insufficient historical data'
    };
  }
  
  // H2H advantage calculation (-1 to 1 scale)
  const h2hAdvantage = h2h 
    ? ((h2h.homeWinPercentage - h2h.awayWinPercentage) / 100) 
    : 0;
  
  // Home venue strength (relative to 50% baseline)
  const homeVenueStrength = homeVenue 
    ? ((homeVenue.winPercentage - 50) / 50) 
    : 0;
  
  // Away form strength  
  const awayFormStrength = awayVenue 
    ? ((awayVenue.winPercentage - 30) / 70) // Away wins are harder, baseline is 30%
    : 0;
  
  // Build recommendation
  let recommendation = '';
  if (h2h && h2h.totalMatches >= 5) {
    if (h2h.homeWinPercentage > 60) recommendation = `${homeTeam} dominates this fixture historically (${h2h.homeWinPercentage}% win rate)`;
    else if (h2h.awayWinPercentage > 50) recommendation = `${awayTeam} performs well in this fixture (${h2h.awayWinPercentage}% win rate)`;
    else if (h2h.drawPercentage > 35) recommendation = `High draw tendency in this fixture (${h2h.drawPercentage}% draws)`;
    else recommendation = `Evenly matched historically`;
  } else {
    recommendation = 'Limited H2H history';
  }
  
  return {
    h2hAdvantage: Math.round(h2hAdvantage * 100) / 100,
    homeVenueStrength: Math.round(homeVenueStrength * 100) / 100,
    awayFormStrength: Math.round(awayFormStrength * 100) / 100,
    historicalOver25: h2h?.over25Percentage || 55,
    historicalBTTS: h2h?.bttsPercentage || 50,
    dataPoints: (h2h?.totalMatches || 0) + (homeVenue?.matchesPlayed || 0) + (awayVenue?.matchesPlayed || 0),
    recommendation
  };
}

/**
 * Get league-wide statistics
 */
export async function getLeagueStats(): Promise<{
  totalMatches: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  homeWinPercentage: number;
  drawPercentage: number;
  awayWinPercentage: number;
  over25Percentage: number;
  bttsPercentage: number;
}> {
  const matches = await loadHistoricalData();
  
  let homeGoals = 0, awayGoals = 0;
  let homeWins = 0, draws = 0, awayWins = 0;
  let over25 = 0, btts = 0;
  
  for (const match of matches) {
    homeGoals += match.homeGoals;
    awayGoals += match.awayGoals;
    
    if (match.result === 'H') homeWins++;
    else if (match.result === 'D') draws++;
    else awayWins++;
    
    if (match.homeGoals + match.awayGoals > 2.5) over25++;
    if (match.homeGoals > 0 && match.awayGoals > 0) btts++;
  }
  
  return {
    totalMatches: matches.length,
    avgHomeGoals: Math.round((homeGoals / matches.length) * 100) / 100,
    avgAwayGoals: Math.round((awayGoals / matches.length) * 100) / 100,
    homeWinPercentage: Math.round((homeWins / matches.length) * 100),
    drawPercentage: Math.round((draws / matches.length) * 100),
    awayWinPercentage: Math.round((awayWins / matches.length) * 100),
    over25Percentage: Math.round((over25 / matches.length) * 100),
    bttsPercentage: Math.round((btts / matches.length) * 100)
  };
}

export default {
  loadHistoricalData,
  getH2HStats,
  getVenueStats,
  getSeasonHistory,
  getRecentForm,
  getHistoricalPredictionFactors,
  getLeagueStats
};
