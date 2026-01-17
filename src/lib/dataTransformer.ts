import { FixtureInput } from "./advancedPredictionEngine";
import { getTeamMatches, getLeagueStandings } from "./footballApi";
import { getHeadToHead, formatH2HInsight, getH2HDominance } from "./headToHeadService";

interface TeamStatsFromAPI {
  name: string;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  position: number;
}

interface H2HApiData {
  aggregates?: {
    numberOfMatches: number;
    homeTeam: { wins: number; draws: number; losses: number };
    awayTeam: { wins: number; draws: number; losses: number };
  };
  matches?: Array<{
    utcDate: string;
    homeTeam: { id: number; name: string };
    awayTeam: { id: number; name: string };
    score: { fullTime: { home: number; away: number } };
  }>;
}

// Transform league data to fixture input format
export async function transformMatchToFixture(
  match: any,
  standings: any[],
  h2hApiData?: H2HApiData
): Promise<FixtureInput | null> {
  try {
    // Find standings for both teams
    const homeTeamStanding = standings.find((s) => s.team.id === match.homeTeam.id);
    const awayTeamStanding = standings.find((s) => s.team.id === match.awayTeam.id);

    if (!homeTeamStanding || !awayTeamStanding) {
      return null;
    }

    // Fetch recent matches for form AND H2H (20 matches gives us enough for H2H analysis)
    const homeRecentMatches = await getTeamMatches(match.homeTeam.id, 20);
    const awayRecentMatches = await getTeamMatches(match.awayTeam.id, 20);

    // Calculate form string (use last 5 for form)
    const getFormString = (matches: any[], teamId: number) => {
      if (!matches || matches.length === 0) {
        console.log(`[Form] No matches found for team ${teamId}`);
        return "";
      }
      
      // Filter to only completed matches and get last 5
      const completedMatches = matches.filter((m) => 
        m.score && m.score.fullTime && m.score.fullTime.home !== null
      );
      
      if (completedMatches.length === 0) {
        console.log(`[Form] No completed matches for team ${teamId}`);
        return "";
      }
      
      const formMatches = completedMatches.slice(-5).reverse();
      
      const formString = formMatches
        .map((m) => {
          const score = m.score.fullTime;
          // Check if this team was home or away in this specific match
          const wasHome = m.homeTeam.id === teamId;
          const wasAway = m.awayTeam.id === teamId;
          
          if (!wasHome && !wasAway) {
            console.log(`[Form] Match ${m.id} doesn't involve team ${teamId}`);
            return "?";
          }
          
          if (wasHome) {
            if (score.home > score.away) return "W";
            if (score.home === score.away) return "D";
            return "L";
          } else {
            if (score.away > score.home) return "W";
            if (score.away === score.home) return "D";
            return "L";
          }
        })
        .join("");
      
      console.log(`[Form] Team ${teamId}: ${formString} (from ${formMatches.length} matches)`);
      return formString;
    };

    // Calculate home/away records
    const getHomeAwayRecord = (matches: any[], teamId: number, isHome: boolean) => {
      const filtered = matches.filter((m) => (isHome ? m.homeTeam.id === teamId : m.awayTeam.id === teamId));
      const wins = filtered.filter((m) => {
        const home = m.homeTeam.id === teamId;
        if (home) return m.score.fullTime.home > m.score.fullTime.away;
        return m.score.fullTime.away > m.score.fullTime.home;
      }).length;
      const draws = filtered.filter((m) => m.score.fullTime.home === m.score.fullTime.away).length;
      const losses = filtered.length - wins - draws;
      return { wins, draws, losses };
    };

    // Calculate H2H record from the last 10 meetings
    const calculateH2H = (allMatches: any[], homeTeamId: number, awayTeamId: number) => {
      // Filter for H2H matches and deduplicate by match ID
      const h2hMatchesMap = new Map<string, any>();
      allMatches.forEach((m) => {
        if (
          (m.homeTeam.id === homeTeamId && m.awayTeam.id === awayTeamId) ||
          (m.homeTeam.id === awayTeamId && m.awayTeam.id === homeTeamId)
        ) {
          h2hMatchesMap.set(m.id.toString(), m);
        }
      });
      
      // Sort by date (newest first) and take last 10
      const h2hMatches = Array.from(h2hMatchesMap.values())
        .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
        .slice(0, 10);

      let homeWins = 0;
      let draws = 0;
      let awayWins = 0;
      const recentMatches: Array<{ result: "H" | "D" | "A"; date: string }> = [];

      h2hMatches.forEach((m) => {
        const isHomeTeamHome = m.homeTeam.id === homeTeamId;
        const score = m.score.fullTime;
        
        if (score.home === null || score.away === null) return; // Skip unplayed matches

        let result: "H" | "D" | "A";
        
        if (score.home > score.away) {
          result = isHomeTeamHome ? "H" : "A";
          if (isHomeTeamHome) homeWins++;
          else awayWins++;
        } else if (score.home === score.away) {
          result = "D";
          draws++;
        } else {
          result = isHomeTeamHome ? "A" : "H";
          if (isHomeTeamHome) awayWins++;
          else homeWins++;
        }

        recentMatches.push({ result, date: m.utcDate });
      });

      console.log(`[H2H] Found ${h2hMatches.length} H2H matches between teams`);

      return {
        home_wins: homeWins,
        draws,
        away_wins: awayWins,
        recent_matches: recentMatches, // Already limited to 10 above
      };
    };

    const homeRecord = getHomeAwayRecord(homeRecentMatches.slice(-5), match.homeTeam.id, true);
    const homeAwayRecord = getHomeAwayRecord(homeRecentMatches.slice(-5), match.homeTeam.id, false);
    const awayRecord = getHomeAwayRecord(awayRecentMatches.slice(-5), match.awayTeam.id, true);
    const awayAwayRecord = getHomeAwayRecord(awayRecentMatches.slice(-5), match.awayTeam.id, false);

    // Get H2H data - uses local historical data (1993-2024) as primary source
    let h2hData: { home_wins: number; draws: number; away_wins: number; recent_matches: Array<{ result: "H" | "D" | "A"; date: string }> };
    
    // Get H2H from local data (pass team names for better matching)
    const apiH2H = await getHeadToHead(
      match.homeTeam.id, 
      match.awayTeam.id, 
      10,
      match.homeTeam.name,  // Pass team names for local lookup
      match.awayTeam.name
    );
    
    if (apiH2H && apiH2H.totalMatches > 0) {
      // Use H2H data (last 10 games from local historical data)
      const recentH2HMatches: Array<{ result: "H" | "D" | "A"; date: string }> = apiH2H.matches.map((m) => {
        let result: "H" | "D" | "A";
        if (m.homeScore > m.awayScore) {
          result = "H";
        } else if (m.homeScore === m.awayScore) {
          result = "D";
        } else {
          result = "A";
        }
        return { result, date: m.date };
      });
      
      h2hData = {
        home_wins: apiH2H.homeWins,
        draws: apiH2H.draws,
        away_wins: apiH2H.awayWins,
        recent_matches: recentH2HMatches,
      };
    } else if (h2hApiData?.aggregates && h2hApiData?.matches) {
      // Fallback to Football-Data.org H2H if available
      const recentH2HMatches: Array<{ result: "H" | "D" | "A"; date: string }> = h2hApiData.matches.map((m) => {
        const isHomeTeamHome = m.homeTeam.id === match.homeTeam.id;
        const score = m.score.fullTime;
        let result: "H" | "D" | "A";
        
        if (score.home > score.away) {
          result = isHomeTeamHome ? "H" : "A";
        } else if (score.home === score.away) {
          result = "D";
        } else {
          result = isHomeTeamHome ? "A" : "H";
        }
        return { result, date: m.utcDate };
      });
      
      h2hData = {
        home_wins: h2hApiData.aggregates.homeTeam.wins,
        draws: h2hApiData.aggregates.homeTeam.draws,
        away_wins: h2hApiData.aggregates.awayTeam.wins,
        recent_matches: recentH2HMatches,
      };
      console.log(`[H2H] Using Football-Data.org API: ${h2hApiData.aggregates.numberOfMatches} matches found`);
    } else {
      // Final fallback: calculate from recent team matches
      const allRecentMatches = [...homeRecentMatches, ...awayRecentMatches];
      h2hData = calculateH2H(allRecentMatches, match.homeTeam.id, match.awayTeam.id);
    }

    const fixture: FixtureInput = {
      match: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      date: match.utcDate,
      home_team: {
        name: match.homeTeam.name,
        league_position: homeTeamStanding.position,
        points: homeTeamStanding.points,
        recent_form: getFormString(homeRecentMatches, match.homeTeam.id),
        goals_for: homeTeamStanding.goalsFor,
        goals_against: homeTeamStanding.goalsAgainst,
        home_wins: homeRecord.wins,
        home_draws: homeRecord.draws,
        home_losses: homeRecord.losses,
        away_wins: homeAwayRecord.wins,
        away_draws: homeAwayRecord.draws,
        away_losses: homeAwayRecord.losses,
        injuries: [],
        played: homeTeamStanding.playedGames, // NEW: For xG calculation
        teamId: match.homeTeam.id,            // NEW: For player data
      },
      away_team: {
        name: match.awayTeam.name,
        league_position: awayTeamStanding.position,
        points: awayTeamStanding.points,
        recent_form: getFormString(awayRecentMatches, match.awayTeam.id),
        goals_for: awayTeamStanding.goalsFor,
        goals_against: awayTeamStanding.goalsAgainst,
        home_wins: awayRecord.wins,
        home_draws: awayRecord.draws,
        home_losses: awayRecord.losses,
        away_wins: awayAwayRecord.wins,
        away_draws: awayAwayRecord.draws,
        away_losses: awayAwayRecord.losses,
        injuries: [],
        played: awayTeamStanding.playedGames, // NEW: For xG calculation
        teamId: match.awayTeam.id,            // NEW: For player data
      },
      head_to_head: {
        home_wins: h2hData.home_wins,
        draws: h2hData.draws,
        away_wins: h2hData.away_wins,
        recent_matches: h2hData.recent_matches,
      },
    };

    return fixture;
  } catch (error) {
    console.error("Error transforming match:", error);
    return null;
  }
}
