// Head-to-Head Service
// Primary: Local historical data (1993-2024, 12,000+ matches)
// Fallback: SportMonks API

import axios from "axios";
import { apiCache } from "./apiCache";
import { getLocalH2H, formatLocalH2HInsight, type LocalH2HResult } from "./localH2HService";

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const SPORTMONKS_URL = process.env.SPORTMONKS_API_URL || "https://api.sportmonks.com/v3";

// Team ID mapping: Football-Data.org ID -> SportMonks ID
// SportMonks Premier League team IDs
const TEAM_ID_MAP: Record<number, number> = {
  // Premier League teams (Football-Data.org -> SportMonks)
  57: 19,    // Arsenal
  58: 15,    // Aston Villa
  402: 1627, // Brentford
  397: 78,   // Brighton & Hove Albion
  1044: 60,  // AFC Bournemouth
  61: 18,    // Chelsea
  354: 62,   // Crystal Palace
  62: 7,     // Everton
  63: 83,    // Fulham
  351: 65,   // Nottingham Forest
  64: 8,     // Liverpool
  65: 9,     // Manchester City
  66: 10,    // Manchester United
  67: 23,    // Newcastle United
  68: 76,    // Wolverhampton Wanderers
  563: 72,   // West Ham United
  73: 6,     // Tottenham Hotspur
  349: 82,   // Ipswich Town
  76: 46,    // Leicester City
  341: 45,   // Southampton
  // Championship/Other teams
  328: 44,   // Burnley
  338: 66,   // Sheffield United
  389: 95,   // Luton Town
  346: 27,   // Watford
};

interface H2HMatch {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  venue: string;
  league: string;
}

interface H2HResult {
  totalMatches: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  matches: H2HMatch[];
  homeTeamName: string;
  awayTeamName: string;
}

/**
 * Get H2H data - Primary: Local historical data, Fallback: SportMonks API
 * @param homeTeamId Football-Data.org team ID (or 0 if using team names)
 * @param awayTeamId Football-Data.org team ID (or 0 if using team names)
 * @param limit Number of matches to fetch (max 10)
 * @param homeTeamName Optional team name for local lookup
 * @param awayTeamName Optional team name for local lookup
 */
export async function getHeadToHead(
  homeTeamId: number,
  awayTeamId: number,
  limit: number = 10,
  homeTeamName?: string,
  awayTeamName?: string
): Promise<H2HResult | null> {
  // Try local historical data first (if team names provided)
  if (homeTeamName && awayTeamName) {
    const localH2H = getLocalH2H(homeTeamName, awayTeamName, limit);
    
    if (localH2H && localH2H.totalMatches > 0) {
      console.log(`[H2H] ✓ LOCAL DATA - Found ${localH2H.totalMatches} matches between ${homeTeamName} and ${awayTeamName}`);
      
      // Convert to H2HResult format
      return {
        totalMatches: localH2H.totalMatches,
        homeWins: localH2H.homeWins,
        draws: localH2H.draws,
        awayWins: localH2H.awayWins,
        homeTeamName: localH2H.homeTeamName,
        awayTeamName: localH2H.awayTeamName,
        matches: localH2H.matches.map(m => ({
          date: m.date,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          venue: m.venue === "home" ? "Home" : "Away",
          league: "Premier League",
        })),
      };
    }
  }

  // Fallback to SportMonks API if local data not found
  // Map to SportMonks IDs
  const smHomeId = TEAM_ID_MAP[homeTeamId];
  const smAwayId = TEAM_ID_MAP[awayTeamId];

  if (!smHomeId || !smAwayId) {
    console.warn(`[H2H] Team ID mapping not found: ${homeTeamId} or ${awayTeamId}`);
    return null;
  }

  const cacheKey = `h2h_sm_${smHomeId}_${smAwayId}`;

  // Check cache first (24 hour TTL for H2H)
  const cached = apiCache.get(cacheKey);
  if (cached) {
    console.log(`[H2H] ✓ CACHED - ${smHomeId} vs ${smAwayId}`);
    return cached as H2HResult;
  }

  if (!SPORTMONKS_API_KEY) {
    console.warn("[H2H] SPORTMONKS_API_KEY not configured");
    return null;
  }

  try {
    console.log(`[H2H] Fetching H2H from SportMonks: teams ${smHomeId} vs ${smAwayId}...`);
    
    // SportMonks H2H endpoint - try different URL format
    const url = `${SPORTMONKS_URL}/football/fixtures/head-to-head/${smHomeId}/${smAwayId}`;
    console.log(`[H2H] URL: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        "Authorization": SPORTMONKS_API_KEY,
      },
      params: {
        per_page: limit,
        include: "participants;scores",
      },
      timeout: 10000,
    });

    const data = response.data;
    console.log(`[H2H] SportMonks status: ${response.status}`);
    console.log(`[H2H] SportMonks response keys: ${Object.keys(data).join(', ')}`);
    console.log(`[H2H] SportMonks data: ${JSON.stringify(data).slice(0, 500)}...`);

    if (!data.data || data.data.length === 0) {
      console.log("[H2H] No H2H matches found in SportMonks response");
      return {
        totalMatches: 0,
        homeWins: 0,
        draws: 0,
        awayWins: 0,
        matches: [],
        homeTeamName: "",
        awayTeamName: "",
      };
    }

    const fixtures = data.data;

    // Process matches
    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;
    let homeTeamName = "";
    let awayTeamName = "";

    const matches: H2HMatch[] = fixtures.map((f: any) => {
      // SportMonks structure: participants array with home/away
      const homeParticipant = f.participants?.find((p: any) => p.meta?.location === "home");
      const awayParticipant = f.participants?.find((p: any) => p.meta?.location === "away");
      
      // Get scores from the scores array
      const homeScoreObj = f.scores?.find((s: any) => s.participant_id === homeParticipant?.id && s.description === "CURRENT");
      const awayScoreObj = f.scores?.find((s: any) => s.participant_id === awayParticipant?.id && s.description === "CURRENT");
      
      const homeTeamInMatch = homeParticipant?.name || "Unknown";
      const awayTeamInMatch = awayParticipant?.name || "Unknown";
      const homeScore = homeScoreObj?.score?.goals ?? f.scores?.[0]?.score?.goals ?? 0;
      const awayScore = awayScoreObj?.score?.goals ?? f.scores?.[1]?.score?.goals ?? 0;

      // Track the original home team's results (the team we're querying about)
      const isOriginalHomeTeamHome = homeParticipant?.id === smHomeId;
      
      if (!homeTeamName && isOriginalHomeTeamHome) {
        homeTeamName = homeTeamInMatch;
        awayTeamName = awayTeamInMatch;
      } else if (!homeTeamName && !isOriginalHomeTeamHome) {
        homeTeamName = awayTeamInMatch;
        awayTeamName = homeTeamInMatch;
      }

      // Calculate result from perspective of original home team
      if (homeScore > awayScore) {
        if (isOriginalHomeTeamHome) homeWins++;
        else awayWins++;
      } else if (homeScore < awayScore) {
        if (isOriginalHomeTeamHome) awayWins++;
        else homeWins++;
      } else {
        draws++;
      }

      return {
        date: f.starting_at || f.date || "",
        homeTeam: homeTeamInMatch,
        awayTeam: awayTeamInMatch,
        homeScore,
        awayScore,
        venue: f.venue?.name || "Unknown",
        league: f.league?.name || "Unknown",
      };
    });

    const result: H2HResult = {
      totalMatches: fixtures.length,
      homeWins,
      draws,
      awayWins,
      matches,
      homeTeamName,
      awayTeamName,
    };

    // Cache for 24 hours
    apiCache.set(cacheKey, result, "H2H");
    console.log(`[H2H] ⚠ FRESH - Found ${fixtures.length} H2H matches: ${homeTeamName} ${homeWins}-${draws}-${awayWins} ${awayTeamName}`);

    return result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("[H2H] SportMonks API request failed:", error.message);
      if (error.response) {
        console.error("[H2H] Status:", error.response.status);
        console.error("[H2H] Response:", JSON.stringify(error.response.data).slice(0, 200));
      }
    } else {
      console.error("[H2H] Error:", error);
    }
    return null;
  }
}

/**
 * Format H2H result for display
 */
export function formatH2HInsight(h2h: H2HResult | null): string {
  if (!h2h || h2h.totalMatches === 0) {
    return "No previous meetings found";
  }

  const { homeWins, draws, awayWins, homeTeamName, awayTeamName, totalMatches } = h2h;

  if (homeWins > awayWins) {
    const diff = homeWins - awayWins;
    return `${homeTeamName} leads H2H ${homeWins}-${awayWins} (${draws} draws) in last ${totalMatches} meetings`;
  } else if (awayWins > homeWins) {
    const diff = awayWins - homeWins;
    return `${awayTeamName} leads H2H ${awayWins}-${homeWins} (${draws} draws) in last ${totalMatches} meetings`;
  } else {
    return `Even H2H record: ${homeWins}-${draws}-${awayWins} in last ${totalMatches} meetings`;
  }
}

/**
 * Get H2H dominance description
 */
export function getH2HDominance(h2h: H2HResult | null): string {
  if (!h2h || h2h.totalMatches === 0) return "Unknown";

  const { homeWins, awayWins, totalMatches } = h2h;
  const homeWinRate = homeWins / totalMatches;
  const awayWinRate = awayWins / totalMatches;

  if (homeWinRate >= 0.6) return "Home dominant";
  if (awayWinRate >= 0.6) return "Away dominant";
  if (homeWinRate >= 0.4 && homeWinRate <= 0.5) return "Home slight edge";
  if (awayWinRate >= 0.4 && awayWinRate <= 0.5) return "Away slight edge";
  return "Even";
}
