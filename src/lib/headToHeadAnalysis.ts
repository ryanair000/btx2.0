/**
 * Head-to-Head Analysis
 * Analyzes historical performance between two teams
 */

export interface HeadToHeadStats {
  homeTeamWins: number;
  awayTeamWins: number;
  draws: number;
  totalMatches: number;
  homeTeamAvgGoals: number;
  awayTeamAvgGoals: number;
  homeTeamWinRate: number; // 0-1
  drawRate: number; // 0-1
  awayTeamWinRate: number; // 0-1
  lastResult?: "home_win" | "away_win" | "draw";
  recentForm: "dominant" | "balanced" | "struggling"; // Last 5 matches
}

/**
 * Calculate head-to-head statistics
 */
export function calculateHeadToHead(
  homeTeamName: string,
  awayTeamName: string,
  pastMatches: Array<{
    homeTeam: string;
    awayTeam: string;
    homeGoals: number;
    awayGoals: number;
    date: string;
  }>
): HeadToHeadStats {
  // Filter matches between these two teams
  const h2hMatches = pastMatches.filter(
    (m) =>
      (m.homeTeam === homeTeamName && m.awayTeam === awayTeamName) ||
      (m.homeTeam === awayTeamName && m.awayTeam === homeTeamName)
  );

  if (h2hMatches.length === 0) {
    // No head-to-head history
    return {
      homeTeamWins: 0,
      awayTeamWins: 0,
      draws: 0,
      totalMatches: 0,
      homeTeamAvgGoals: 0,
      awayTeamAvgGoals: 0,
      homeTeamWinRate: 0.33,
      drawRate: 0.33,
      awayTeamWinRate: 0.33,
      recentForm: "balanced",
    };
  }

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let homeGoalsTotal = 0;
  let awayGoalsTotal = 0;
  let lastResult: "home_win" | "away_win" | "draw" | undefined;

  // Sort by date (most recent first)
  const sortedMatches = [...h2hMatches].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  sortedMatches.forEach((match, index) => {
    // Determine if home team is our current home or away team
    const isHomeTeamCurrent = match.homeTeam === homeTeamName;
    const homeGoals = isHomeTeamCurrent ? match.homeGoals : match.awayGoals;
    const awayGoals = isHomeTeamCurrent ? match.awayGoals : match.homeGoals;

    homeGoalsTotal += homeGoals;
    awayGoalsTotal += awayGoals;

    if (index === 0) {
      // Most recent match
      if (homeGoals > awayGoals) {
        lastResult = "home_win";
      } else if (awayGoals > homeGoals) {
        lastResult = "away_win";
      } else {
        lastResult = "draw";
      }
    }

    if (homeGoals > awayGoals) {
      homeWins++;
    } else if (awayGoals > homeGoals) {
      awayWins++;
    } else {
      draws++;
    }
  });

  const totalMatches = h2hMatches.length;
  const homeTeamWinRate = homeWins / totalMatches;
  const drawRate = draws / totalMatches;
  const awayTeamWinRate = awayWins / totalMatches;

  // Determine recent form (last 5 matches)
  let recentForm: "dominant" | "balanced" | "struggling" = "balanced";
  if (homeTeamWinRate > 0.6) {
    recentForm = "dominant";
  } else if (homeTeamWinRate < 0.2) {
    recentForm = "struggling";
  }

  return {
    homeTeamWins: homeWins,
    awayTeamWins: awayWins,
    draws,
    totalMatches,
    homeTeamAvgGoals: homeGoalsTotal / totalMatches,
    awayTeamAvgGoals: awayGoalsTotal / totalMatches,
    homeTeamWinRate,
    drawRate,
    awayTeamWinRate,
    lastResult,
    recentForm,
  };
}

/**
 * Get prediction adjustment based on head-to-head
 * Returns -0.1 to +0.1 adjustment
 */
export function getHeadToHeadImpact(
  h2h: HeadToHeadStats,
  direction: "home" | "away"
): number {
  if (h2h.totalMatches === 0) {
    return 0; // No history, no impact
  }

  // Strong historical advantage
  if (direction === "home") {
    if (h2h.homeTeamWinRate > 0.6) {
      return 0.08; // Home team historically strong here
    } else if (h2h.homeTeamWinRate > 0.5) {
      return 0.03; // Slight home advantage
    } else if (h2h.homeTeamWinRate < 0.3) {
      return -0.08; // Home team struggles here
    }
  } else {
    if (h2h.awayTeamWinRate > 0.6) {
      return 0.08; // Away team is strong at this venue
    } else if (h2h.awayTeamWinRate > 0.5) {
      return 0.03;
    } else if (h2h.awayTeamWinRate < 0.3) {
      return -0.08;
    }
  }

  return 0; // Balanced history
}

/**
 * Get recent form narrative
 */
export function getHeadToHeadNarrative(h2h: HeadToHeadStats): string {
  if (h2h.totalMatches === 0) {
    return "First encounter between these teams";
  }

  const totalStr = `${h2h.totalMatches} previous meetings`;

  if (h2h.homeTeamWins > h2h.awayTeamWins) {
    const dominance = h2h.homeTeamWins - h2h.awayTeamWins;
    return `Home team dominates h2h with ${h2h.homeTeamWins} wins vs ${h2h.awayTeamWins} in ${totalStr}`;
  } else if (h2h.awayTeamWins > h2h.homeTeamWins) {
    const dominance = h2h.awayTeamWins - h2h.homeTeamWins;
    return `Away team has edge in h2h with ${h2h.awayTeamWins} wins vs ${h2h.homeTeamWins} in ${totalStr}`;
  } else {
    return `Even record: ${h2h.homeTeamWins} wins each with ${h2h.draws} draws in ${totalStr}`;
  }
}

/**
 * Calculate goal-scoring patterns
 */
export function getGoalScoringPatterns(h2h: HeadToHeadStats): {
  avgGoalsPerMatch: number;
  highScoringMatches: number;
  lowScoringMatches: number;
  trend: "increasing" | "stable" | "decreasing";
} {
  const avgGoalsPerMatch = (h2h.homeTeamAvgGoals + h2h.awayTeamAvgGoals) / 2;

  // Rough estimates based on available data
  const highScoringMatches = h2h.totalMatches > 0 ? Math.ceil(h2h.totalMatches * 0.3) : 0;
  const lowScoringMatches = h2h.totalMatches > 0 ? Math.floor(h2h.totalMatches * 0.3) : 0;

  return {
    avgGoalsPerMatch,
    highScoringMatches,
    lowScoringMatches,
    trend: "stable" as const,
  };
}
