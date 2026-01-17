// API service to fetch real Premier League data
import axios, { AxiosError } from "axios";
import { apiCache } from "./apiCache";
import { 
  getUpcomingMatchesFromCalendar, 
  getMatchesByMatchdayFromCalendar 
} from "./calendarService";

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const FOOTBALL_DATA_URL = process.env.FOOTBALL_DATA_URL || "https://api.football-data.org/v4";

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

interface Team {
  id: number;
  name: string;
  crest?: string;
}

interface Match {
  id: string;
  utcDate: string;
  status: string;
  homeTeam: Team;
  awayTeam: Team;
  score?: {
    fullTime: {
      home: number;
      away: number;
    };
  };
}

interface LeagueStanding {
  position: number;
  team: Team;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

// Helper function to retry API calls
async function retryApiCall<T>(
  fn: () => Promise<T>,
  context: string,
  retries: number = MAX_RETRIES
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const isRetryable = status === 429 || (status && status >= 500);

    if (isRetryable && retries > 0) {
      const delay = RETRY_DELAY * (MAX_RETRIES - retries + 1);
      console.warn(
        `${context} - Rate limited or server error. Retrying in ${delay}ms... (${retries} retries left)`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryApiCall(fn, context, retries - 1);
    }

    // Log detailed error info
    if (axiosError.response) {
      console.error(
        `${context} failed - Status: ${status}, Message: ${axiosError.message}`
      );
    } else if (axiosError.request) {
      console.error(`${context} failed - No response received: ${axiosError.message}`);
    } else {
      console.error(`${context} error: ${axiosError.message}`);
    }

    throw error;
  }
}

// Fetch upcoming fixtures
export async function getUpcomingMatches() {
  const cacheKey = "upcoming_matches";
  
  // Check cache first
  const cached = apiCache.get(cacheKey);
  if (cached) {
    apiCache.logUsage("getUpcomingMatches", true);
    return cached;
  }

  // Check quota before making request
  if (!apiCache.isWithinQuota()) {
    console.warn("⚠️  Daily API quota exceeded. Using calendar fallback...");
    return getCalendarFallbackMatches();
  }

  return retryApiCall(
    async () => {
      const response = await axios.get(
        `${FOOTBALL_DATA_URL}/competitions/PL/matches`,
        {
          headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY },
          params: { status: "SCHEDULED" },
          timeout: 10000,
        }
      );
      const data = response.data?.matches || [];
      apiCache.set(cacheKey, data, "UPCOMING_MATCHES");
      apiCache.logUsage("getUpcomingMatches", false);
      return data;
    },
    "getUpcomingMatches"
  ).catch(async (error) => {
    console.error("Failed to fetch upcoming matches, using calendar fallback...");
    return getCalendarFallbackMatches();
  });
}

// Fetch matches for a specific matchday
export async function getMatchesByMatchday(matchday: number) {
  const cacheKey = `matchday_${matchday}`;
  
  // Check cache first
  const cached = apiCache.get(cacheKey);
  if (cached) {
    apiCache.logUsage(`getMatchesByMatchday(${matchday})`, true);
    return cached;
  }

  // Check quota before making request
  if (!apiCache.isWithinQuota()) {
    console.warn(`⚠️  Daily API quota exceeded. Using calendar fallback for matchday ${matchday}...`);
    return getCalendarFallbackMatches(matchday);
  }

  return retryApiCall(
    async () => {
      const response = await axios.get(
        `${FOOTBALL_DATA_URL}/competitions/PL/matches`,
        {
          headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY },
          params: { matchday },
          timeout: 10000,
        }
      );
      const data = response.data?.matches || [];
      apiCache.set(cacheKey, data, "UPCOMING_MATCHES");
      apiCache.logUsage(`getMatchesByMatchday(${matchday})`, false);
      return data;
    },
    `getMatchesByMatchday(${matchday})`
  ).catch(async (error) => {
    console.error(`Failed to fetch matchday ${matchday}, using calendar fallback...`);
    return getCalendarFallbackMatches(matchday);
  });
}

// Fetch league standings
export async function getLeagueStandings() {
  const cacheKey = "league_standings";
  
  // Check cache first
  const cached = apiCache.get(cacheKey);
  if (cached) {
    apiCache.logUsage("getLeagueStandings", true);
    return cached;
  }

  // Check quota before making request
  if (!apiCache.isWithinQuota()) {
    console.warn("⚠️  Daily API quota exceeded. Using default standings...");
    return getDefaultStandings();
  }

  return retryApiCall(
    async () => {
      const response = await axios.get(
        `${FOOTBALL_DATA_URL}/competitions/PL/standings`,
        {
          headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY },
          timeout: 10000,
        }
      );
      const data = response.data?.standings?.[0]?.table || [];
      apiCache.set(cacheKey, data, "STANDINGS");
      apiCache.logUsage("getLeagueStandings", false);
      return data;
    },
    "getLeagueStandings"
  ).catch(async (error) => {
    console.error("Failed to fetch league standings, using defaults...");
    return getDefaultStandings();
  });
}

// Fetch recent matches for a team
export async function getTeamMatches(teamId: number, limit: number = 5) {
  const cacheKey = `team_matches_${teamId}_${limit}`;
  
  // Check cache first
  const cached = apiCache.get(cacheKey);
  if (cached) {
    apiCache.logUsage(`getTeamMatches(${teamId})`, true);
    return cached;
  }

  // Check quota before making request
  if (!apiCache.isWithinQuota()) {
    console.warn("⚠️  Daily API quota exceeded. Returning empty data.");
    return [];
  }

  return apiCache.deduplicate(cacheKey, async () => {
    return retryApiCall(
      async () => {
        const response = await axios.get(
          `${FOOTBALL_DATA_URL}/teams/${teamId}/matches`,
          {
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY },
            params: { limit, status: "FINISHED" },
            timeout: 10000,
          }
        );
        const data = response.data?.matches || [];
        apiCache.set(cacheKey, data, "TEAM_MATCHES");
        apiCache.logUsage(`getTeamMatches(${teamId})`, false);
        return data;
      },
      `getTeamMatches(${teamId})`
    ).catch((error) => {
      console.error(`Failed to fetch team matches for ${teamId}`);
      return [];
    });
  });
}

// Fetch team details
export async function getTeamDetails(teamId: number) {
  const cacheKey = `team_details_${teamId}`;
  
  // Check cache first
  const cached = apiCache.get(cacheKey);
  if (cached) {
    apiCache.logUsage(`getTeamDetails(${teamId})`, true);
    return cached;
  }

  // Check quota before making request
  if (!apiCache.isWithinQuota()) {
    console.warn("⚠️  Daily API quota exceeded. Returning null.");
    return null;
  }

  return retryApiCall(
    async () => {
      const response = await axios.get(`${FOOTBALL_DATA_URL}/teams/${teamId}`, {
        headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY },
        timeout: 10000,
      });
      const data = response.data;
      apiCache.set(cacheKey, data, "TEAM_DETAILS");
      apiCache.logUsage(`getTeamDetails(${teamId})`, false);
      return data;
    },
    `getTeamDetails(${teamId})`
  ).catch((error) => {
    console.error(`Failed to fetch team details for ${teamId}`);
    return null;
  });
}

// Fetch head-to-head data for a specific match (last 10 meetings)
export async function getMatchHeadToHead(matchId: string): Promise<{ aggregates: any; matches: any[] } | null> {
  const cacheKey = `h2h_${matchId}`;
  
  // Check cache first
  const cached = apiCache.get(cacheKey);
  if (cached) {
    apiCache.logUsage(`getMatchH2H(${matchId})`, true);
    return cached as { aggregates: any; matches: any[] };
  }

  // Check quota before making request
  if (!apiCache.isWithinQuota()) {
    console.warn("⚠️  Daily API quota exceeded. Returning null.");
    return null;
  }

  return retryApiCall(
    async () => {
      // Football-data.org provides H2H when fetching match with head2head param
      console.log(`[H2H API] Fetching H2H for match ${matchId}...`);
      const response = await axios.get(`${FOOTBALL_DATA_URL}/matches/${matchId}`, {
        headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY },
        timeout: 10000,
      });
      const data = response.data;
      
      // Extract H2H from the response - need to check the response structure
      console.log(`[H2H API] Response keys: ${Object.keys(data).join(', ')}`);
      
      // Football-Data.org v4 returns head2head in a separate endpoint
      // Try fetching from the head2head endpoint
      let h2hData: { aggregates: any; matches: any[] } = {
        aggregates: null,
        matches: [],
      };
      
      // If match has homeTeam and awayTeam, try to get H2H
      if (data.homeTeam?.id && data.awayTeam?.id) {
        try {
          const h2hResponse = await axios.get(
            `${FOOTBALL_DATA_URL}/teams/${data.homeTeam.id}/matches`,
            {
              headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY },
              params: { status: "FINISHED", limit: 50 },
              timeout: 10000,
            }
          );
          
          // Filter for H2H matches only
          const h2hMatches = (h2hResponse.data.matches || []).filter(
            (m: any) => 
              (m.homeTeam.id === data.homeTeam.id && m.awayTeam.id === data.awayTeam.id) ||
              (m.homeTeam.id === data.awayTeam.id && m.awayTeam.id === data.homeTeam.id)
          ).slice(0, 10);
          
          // Calculate aggregates
          let homeWins = 0, awayWins = 0, draws = 0;
          h2hMatches.forEach((m: any) => {
            const isHomeTeamHome = m.homeTeam.id === data.homeTeam.id;
            const score = m.score?.fullTime;
            if (!score || score.home === null) return;
            
            if (score.home > score.away) {
              if (isHomeTeamHome) homeWins++; else awayWins++;
            } else if (score.home === score.away) {
              draws++;
            } else {
              if (isHomeTeamHome) awayWins++; else homeWins++;
            }
          });
          
          h2hData = {
            aggregates: {
              numberOfMatches: h2hMatches.length,
              homeTeam: { wins: homeWins, draws, losses: awayWins },
              awayTeam: { wins: awayWins, draws, losses: homeWins },
            },
            matches: h2hMatches,
          };
          
          console.log(`[H2H API] Found ${h2hMatches.length} H2H matches`);
        } catch (h2hErr) {
          console.warn(`[H2H API] Could not fetch team matches for H2H:`, h2hErr);
        }
      }
      
      apiCache.set(cacheKey, h2hData, "H2H");
      apiCache.logUsage(`getMatchH2H(${matchId})`, false);
      return h2hData;
    },
    `getMatchH2H(${matchId})`
  ).catch((error) => {
    console.error(`[H2H API] Failed to fetch H2H for match ${matchId}:`, error);
    return null;
  });
}

/**
 * CALENDAR FALLBACK - Use Premier League ICS calendar (NO RATE LIMITS!)
 */

async function getCalendarFallbackMatches(matchday?: number) {
  console.log(`📅 Using calendar data for ${matchday ? `matchday ${matchday}` : 'upcoming matches'}...`);
  
  try {
    const calendarMatches = matchday 
      ? await getMatchesByMatchdayFromCalendar(matchday)
      : await getUpcomingMatchesFromCalendar(10);
    
    // Convert calendar format to API format
    const matches = calendarMatches.map(m => ({
      id: m.id,
      utcDate: m.utcDate,
      status: m.status,
      homeTeam: {
        id: Math.abs(hashString(m.homeTeam)),
        name: m.homeTeam,
        shortName: m.homeTeam.replace(/ FC$/, '').replace(/ United$/, ' Utd'),
        crest: `https://crests.football-data.org/${Math.abs(hashString(m.homeTeam))}.png`,
      },
      awayTeam: {
        id: Math.abs(hashString(m.awayTeam)),
        name: m.awayTeam,
        shortName: m.awayTeam.replace(/ FC$/, '').replace(/ United$/, ' Utd'),
        crest: `https://crests.football-data.org/${Math.abs(hashString(m.awayTeam))}.png`,
      },
      venue: m.venue ? { city: m.venue } : undefined,
    }));
    
    console.log(`✓ Got ${matches.length} matches from calendar`);
    return matches;
  } catch (error) {
    console.error('Calendar fallback failed:', error);
    return [];
  }
}

// Simple hash function to generate consistent team IDs
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

// Default standings when API unavailable
function getDefaultStandings() {
  console.log('📊 Using default 24/25 season standings...');
  
  const teams = [
    "Liverpool FC", "Arsenal FC", "Chelsea FC", "Manchester City FC",
    "Nottingham Forest FC", "Bournemouth AFC", "Aston Villa FC",
    "Fulham FC", "Newcastle United FC", "Brighton & Hove Albion FC",
    "Brentford FC", "Manchester United FC", "Tottenham Hotspur FC",
    "West Ham United FC", "Crystal Palace FC", "Everton FC",
    "Wolverhampton Wanderers FC", "Leicester City FC", "Ipswich Town FC",
    "Southampton FC"
  ];
  
  return teams.map((name, idx) => ({
    position: idx + 1,
    team: {
      id: Math.abs(hashString(name)),
      name,
      shortName: name.replace(/ FC$/, '').replace(/ AFC$/, ''),
      crest: `https://crests.football-data.org/${Math.abs(hashString(name))}.png`,
    },
    playedGames: 20,
    won: Math.max(0, 15 - idx),
    draw: 3,
    lost: Math.min(20, 2 + idx),
    points: Math.max(10, 45 - (idx * 2)),
    goalsFor: Math.max(15, 40 - idx),
    goalsAgainst: Math.min(50, 20 + idx),
    goalDifference: Math.max(-20, 20 - (idx * 2)),
  }));
}
