/**
 * Match Context Service
 * 
 * Provides contextual analysis for matches:
 * - Derby detection
 * - Promoted team analysis
 * - Rest days / fixture congestion
 * - Season stage motivation
 * - Big game factor
 * - Kickoff time impact
 */

// ============ DERBY DETECTION ============

const DERBIES: Array<{ teams: [string, string]; name: string; intensity: 'high' | 'medium' }> = [
  // Major Derbies (high intensity)
  { teams: ["Arsenal", "Tottenham"], name: "North London Derby", intensity: "high" },
  { teams: ["Manchester United", "Manchester City"], name: "Manchester Derby", intensity: "high" },
  { teams: ["Liverpool", "Everton"], name: "Merseyside Derby", intensity: "high" },
  { teams: ["Liverpool", "Manchester United"], name: "North West Derby", intensity: "high" },
  
  // London Derbies (medium-high intensity)
  { teams: ["Chelsea", "Tottenham"], name: "London Derby", intensity: "high" },
  { teams: ["Chelsea", "Arsenal"], name: "London Derby", intensity: "high" },
  { teams: ["Arsenal", "West Ham"], name: "London Derby", intensity: "medium" },
  { teams: ["Chelsea", "Fulham"], name: "West London Derby", intensity: "medium" },
  { teams: ["Chelsea", "West Ham"], name: "London Derby", intensity: "medium" },
  { teams: ["Tottenham", "West Ham"], name: "London Derby", intensity: "medium" },
  { teams: ["Crystal Palace", "Brighton"], name: "M23 Derby", intensity: "high" },
  
  // Midlands Derbies
  { teams: ["Aston Villa", "Wolverhampton"], name: "West Midlands Derby", intensity: "high" },
  { teams: ["Aston Villa", "Birmingham"], name: "Second City Derby", intensity: "high" },
  { teams: ["Nottingham Forest", "Leicester"], name: "East Midlands Derby", intensity: "high" },
  { teams: ["Nottingham Forest", "Derby"], name: "East Midlands Derby", intensity: "high" },
  
  // Other Notable Rivalries
  { teams: ["Newcastle", "Sunderland"], name: "Tyne-Wear Derby", intensity: "high" },
  { teams: ["Southampton", "Bournemouth"], name: "South Coast Derby", intensity: "medium" },
  { teams: ["Southampton", "Portsmouth"], name: "South Coast Derby", intensity: "high" },
  { teams: ["Leeds", "Manchester United"], name: "Roses Rivalry", intensity: "high" },
  { teams: ["Burnley", "Blackburn"], name: "East Lancashire Derby", intensity: "high" },
];

export interface DerbyAnalysis {
  isDerby: boolean;
  derbyName: string | null;
  intensity: 'high' | 'medium' | null;
  drawBoost: number;           // Add to draw probability
  confidencePenalty: number;   // Reduce confidence
  insight: string;
}

export function analyzeDerby(homeTeam: string, awayTeam: string): DerbyAnalysis {
  const homeLower = homeTeam.toLowerCase();
  const awayLower = awayTeam.toLowerCase();
  
  for (const derby of DERBIES) {
    const [team1, team2] = derby.teams.map(t => t.toLowerCase());
    
    if ((homeLower.includes(team1) && awayLower.includes(team2)) ||
        (homeLower.includes(team2) && awayLower.includes(team1))) {
      
      const isHighIntensity = derby.intensity === 'high';
      
      return {
        isDerby: true,
        derbyName: derby.name,
        intensity: derby.intensity,
        drawBoost: isHighIntensity ? 0.08 : 0.05,  // 5-8% boost to draw
        confidencePenalty: isHighIntensity ? -8 : -5,  // Reduce confidence
        insight: `🔥 ${derby.name} - historically unpredictable, expect passion over form`
      };
    }
  }
  
  return {
    isDerby: false,
    derbyName: null,
    intensity: null,
    drawBoost: 0,
    confidencePenalty: 0,
    insight: ''
  };
}


// ============ PROMOTED TEAM ANALYSIS ============

// Update this each season
const PROMOTED_TEAMS_2024_25 = [
  { name: "Leicester City", fromChampionship: true },
  { name: "Ipswich Town", fromChampionship: true },
  { name: "Southampton", fromChampionship: true },
];

const PROMOTED_TEAMS_2025_26 = [
  // Update when known
  { name: "Leeds United", fromChampionship: true },
  { name: "Burnley", fromChampionship: true },
  // Add third team when known
];

export interface PromotedTeamAnalysis {
  homeIsPromoted: boolean;
  awayIsPromoted: boolean;
  homeAdjustment: number;
  awayAdjustment: number;
  insight: string;
}

export function analyzePromotedTeams(
  homeTeam: string, 
  awayTeam: string, 
  matchday: number
): PromotedTeamAnalysis {
  // Combine both seasons for flexibility
  const allPromoted = [...PROMOTED_TEAMS_2024_25, ...PROMOTED_TEAMS_2025_26];
  
  const homeIsPromoted = allPromoted.some(t => 
    homeTeam.toLowerCase().includes(t.name.toLowerCase())
  );
  const awayIsPromoted = allPromoted.some(t => 
    awayTeam.toLowerCase().includes(t.name.toLowerCase())
  );
  
  if (!homeIsPromoted && !awayIsPromoted) {
    return {
      homeIsPromoted: false,
      awayIsPromoted: false,
      homeAdjustment: 0,
      awayAdjustment: 0,
      insight: ''
    };
  }
  
  // Penalty decreases as season progresses (teams adapt)
  const seasonProgress = Math.min(matchday / 38, 1);
  const basePenalty = 0.12 * (1 - seasonProgress);  // 12% early → 0% late
  
  // Away is much harder for promoted teams
  const homeAdjustment = homeIsPromoted ? -basePenalty * 0.4 : 0;  // Small home penalty
  const awayAdjustment = awayIsPromoted ? -basePenalty : 0;        // Full away penalty
  
  const insights: string[] = [];
  if (homeIsPromoted) insights.push(`${homeTeam.split(' ')[0]} adjusting to PL`);
  if (awayIsPromoted) insights.push(`${awayTeam.split(' ')[0]} faces tough away test`);
  
  return {
    homeIsPromoted,
    awayIsPromoted,
    homeAdjustment,
    awayAdjustment,
    insight: insights.length > 0 ? `📈 ${insights.join(', ')}` : ''
  };
}


// ============ REST DAYS ANALYSIS ============

export interface RestDaysAnalysis {
  homeRestDays: number;
  awayRestDays: number;
  homeIsFresh: boolean;      // 5+ days
  awayIsFresh: boolean;
  homeIsCongested: boolean;  // 3 or fewer days
  awayIsCongested: boolean;
  homeAdjustment: number;
  awayAdjustment: number;
  insight: string;
}

export function analyzeRestDays(
  homeLastMatchDate: Date | string | null,
  awayLastMatchDate: Date | string | null,
  matchDate: Date | string
): RestDaysAnalysis {
  const match = new Date(matchDate);
  
  // Default to 7 days if unknown
  const homeRest = homeLastMatchDate 
    ? Math.floor((match.getTime() - new Date(homeLastMatchDate).getTime()) / (1000 * 60 * 60 * 24))
    : 7;
  const awayRest = awayLastMatchDate 
    ? Math.floor((match.getTime() - new Date(awayLastMatchDate).getTime()) / (1000 * 60 * 60 * 24))
    : 7;
  
  const homeIsFresh = homeRest >= 5;
  const awayIsFresh = awayRest >= 5;
  const homeIsCongested = homeRest <= 3;
  const awayIsCongested = awayRest <= 3;
  
  let homeAdjustment = 0;
  let awayAdjustment = 0;
  
  // Rest advantage
  if (homeRest > awayRest + 2) {
    homeAdjustment += 0.06;
    awayAdjustment -= 0.04;
  } else if (awayRest > homeRest + 2) {
    awayAdjustment += 0.06;
    homeAdjustment -= 0.04;
  }
  
  // Congestion penalty (compounding)
  if (homeIsCongested) homeAdjustment -= 0.08;
  if (awayIsCongested) awayAdjustment -= 0.08;
  
  // Freshness bonus
  if (homeIsFresh && !awayIsFresh) homeAdjustment += 0.03;
  if (awayIsFresh && !homeIsFresh) awayAdjustment += 0.03;
  
  let insight = '';
  if (homeIsCongested && !awayIsCongested) {
    insight = `⚠️ Home team fatigued (${homeRest} days rest vs ${awayRest})`;
  } else if (awayIsCongested && !homeIsCongested) {
    insight = `⚠️ Away team fatigued (${awayRest} days rest vs ${homeRest})`;
  } else if (homeIsCongested && awayIsCongested) {
    insight = `⚠️ Both teams congested - expect fatigue`;
  } else if (Math.abs(homeRest - awayRest) >= 3) {
    const advantaged = homeRest > awayRest ? 'Home' : 'Away';
    insight = `💪 ${advantaged} has rest advantage (${Math.max(homeRest, awayRest)} vs ${Math.min(homeRest, awayRest)} days)`;
  }
  
  return {
    homeRestDays: homeRest,
    awayRestDays: awayRest,
    homeIsFresh,
    awayIsFresh,
    homeIsCongested,
    awayIsCongested,
    homeAdjustment,
    awayAdjustment,
    insight
  };
}


// ============ SEASON STAGE ANALYSIS ============

export interface SeasonStageAnalysis {
  stage: 'early' | 'mid' | 'late' | 'final';
  matchday: number;
  homeMotivation: number;
  awayMotivation: number;
  homeContext: string;
  awayContext: string;
  insight: string;
}

export function analyzeSeasonStage(
  matchday: number,
  homePosition: number,
  awayPosition: number,
  homePoints?: number,
  awayPoints?: number
): SeasonStageAnalysis {
  const stage: SeasonStageAnalysis['stage'] = 
    matchday <= 10 ? 'early' :
    matchday <= 25 ? 'mid' :
    matchday <= 34 ? 'late' : 'final';
  
  let homeMotivation = 0;
  let awayMotivation = 0;
  let homeContext = '';
  let awayContext = '';
  
  // Late season motivation adjustments
  if (stage === 'late' || stage === 'final') {
    // Title race (1st-2nd)
    if (homePosition <= 2) {
      homeMotivation += 0.10;
      homeContext = 'Title race';
    }
    if (awayPosition <= 2) {
      awayMotivation += 0.10;
      awayContext = 'Title race';
    }
    
    // Champions League spots (3rd-5th with realistic chance)
    if (homePosition >= 3 && homePosition <= 6) {
      homeMotivation += 0.07;
      homeContext = homeContext || 'CL push';
    }
    if (awayPosition >= 3 && awayPosition <= 6) {
      awayMotivation += 0.07;
      awayContext = awayContext || 'CL push';
    }
    
    // Europa League spots (6th-7th)
    if (homePosition >= 6 && homePosition <= 8) {
      homeMotivation += 0.04;
      homeContext = homeContext || 'Europa push';
    }
    if (awayPosition >= 6 && awayPosition <= 8) {
      awayMotivation += 0.04;
      awayContext = awayContext || 'Europa push';
    }
    
    // Relegation battle (17th-20th) - MOST MOTIVATED
    if (homePosition >= 17) {
      homeMotivation += 0.12;
      homeContext = 'Relegation battle';
    }
    if (awayPosition >= 17) {
      awayMotivation += 0.12;
      awayContext = 'Relegation battle';
    }
    
    // Mid-table with nothing to play for - reduced motivation
    if (homePosition >= 10 && homePosition <= 14) {
      homeMotivation -= 0.04;
      homeContext = homeContext || 'Nothing to play for';
    }
    if (awayPosition >= 10 && awayPosition <= 14) {
      awayMotivation -= 0.04;
      awayContext = awayContext || 'Nothing to play for';
    }
  }
  
  // Early season - newly promoted teams still adapting
  if (stage === 'early') {
    homeContext = homeContext || 'Early season';
    awayContext = awayContext || 'Early season';
  }
  
  let insight = '';
  if (homeContext && awayContext && homeContext !== awayContext) {
    insight = `📊 ${homeContext} vs ${awayContext}`;
  } else if (homeMotivation > awayMotivation + 0.05) {
    insight = `🔥 Home more motivated (${homeContext})`;
  } else if (awayMotivation > homeMotivation + 0.05) {
    insight = `🔥 Away more motivated (${awayContext})`;
  }
  
  return {
    stage,
    matchday,
    homeMotivation,
    awayMotivation,
    homeContext,
    awayContext,
    insight
  };
}


// ============ BIG GAME FACTOR ============

const BIG_6 = ['Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United', 'Tottenham'];

export interface BigGameAnalysis {
  isBigGame: boolean;
  gameType: 'big6_clash' | 'top4_battle' | 'relegation_6pointer' | 'title_decider' | 'normal';
  drawBoost: number;
  confidencePenalty: number;
  insight: string;
}

export function analyzeBigGame(
  homeTeam: string,
  awayTeam: string,
  homePosition: number,
  awayPosition: number,
  matchday: number
): BigGameAnalysis {
  const homeBig6 = BIG_6.some(t => homeTeam.toLowerCase().includes(t.toLowerCase()));
  const awayBig6 = BIG_6.some(t => awayTeam.toLowerCase().includes(t.toLowerCase()));
  
  // Big 6 clash
  if (homeBig6 && awayBig6) {
    return {
      isBigGame: true,
      gameType: 'big6_clash',
      drawBoost: 0.06,
      confidencePenalty: -5,
      insight: '⭐ Big 6 clash - expect tight, cagey match'
    };
  }
  
  // Title decider (late season, both in top 2)
  if (matchday >= 30 && homePosition <= 2 && awayPosition <= 2) {
    return {
      isBigGame: true,
      gameType: 'title_decider',
      drawBoost: 0.04,
      confidencePenalty: -6,
      insight: '🏆 Potential title decider'
    };
  }
  
  // Top 4 battle (late season, both 3rd-6th)
  if (matchday >= 28 && homePosition >= 3 && homePosition <= 6 && 
      awayPosition >= 3 && awayPosition <= 6) {
    return {
      isBigGame: true,
      gameType: 'top4_battle',
      drawBoost: 0.04,
      confidencePenalty: -4,
      insight: '🎯 Champions League battle'
    };
  }
  
  // Relegation 6-pointer (both in bottom 5)
  if (homePosition >= 16 && awayPosition >= 16) {
    return {
      isBigGame: true,
      gameType: 'relegation_6pointer',
      drawBoost: 0.05,
      confidencePenalty: -4,
      insight: '⚠️ Relegation six-pointer - desperation factor'
    };
  }
  
  return {
    isBigGame: false,
    gameType: 'normal',
    drawBoost: 0,
    confidencePenalty: 0,
    insight: ''
  };
}


// ============ KICKOFF TIME ANALYSIS ============

export interface KickoffTimeAnalysis {
  dayOfWeek: string;
  kickoffHour: number;
  isEarlyKickoff: boolean;    // Saturday 12:30
  isLateKickoff: boolean;     // 19:30+
  isMidweek: boolean;         // Tue/Wed/Thu
  isMondayNight: boolean;
  isSundayEvening: boolean;
  homeAdvantageAdjustment: number;
  insight: string;
}

export function analyzeKickoffTime(matchDate: Date | string): KickoffTimeAnalysis {
  const date = new Date(matchDate);
  const day = date.getDay();  // 0 = Sunday
  const hour = date.getHours();
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[day];
  
  const isEarlyKickoff = day === 6 && hour <= 13;  // Saturday before 1pm
  const isLateKickoff = hour >= 19;
  const isMidweek = day >= 2 && day <= 4;
  const isMondayNight = day === 1 && hour >= 19;
  const isSundayEvening = day === 0 && hour >= 16;
  
  let homeAdvantageAdjustment = 0;
  let insight = '';
  
  // Early kickoffs historically have less home advantage (fans less rowdy)
  if (isEarlyKickoff) {
    homeAdvantageAdjustment = -0.04;
    insight = '🌅 Early kickoff - reduced home atmosphere';
  }
  
  // Late kickoffs favor home (electric atmosphere)
  if (isLateKickoff && !isMidweek) {
    homeAdvantageAdjustment = 0.04;
    insight = '🌙 Prime time - peak home atmosphere';
  }
  
  // Midweek - less home advantage, travel harder
  if (isMidweek) {
    homeAdvantageAdjustment = -0.02;
    if (isLateKickoff) {
      insight = '📅 Midweek night game - travel factor for away';
    }
  }
  
  // Monday night football - unique atmosphere
  if (isMondayNight) {
    homeAdvantageAdjustment = 0.02;
    insight = '🎬 Monday Night Football - showcase match';
  }
  
  return {
    dayOfWeek,
    kickoffHour: hour,
    isEarlyKickoff,
    isLateKickoff,
    isMidweek,
    isMondayNight,
    isSundayEvening,
    homeAdvantageAdjustment,
    insight
  };
}


// ============ COMBINED MATCH CONTEXT ============

export interface MatchContext {
  derby: DerbyAnalysis;
  promotedTeams: PromotedTeamAnalysis;
  restDays: RestDaysAnalysis;
  seasonStage: SeasonStageAnalysis;
  bigGame: BigGameAnalysis;
  kickoffTime: KickoffTimeAnalysis;
  
  // Aggregated impacts
  totalHomeAdjustment: number;
  totalAwayAdjustment: number;
  totalDrawBoost: number;
  totalConfidencePenalty: number;
  keyInsights: string[];
}

export function getFullMatchContext(
  homeTeam: string,
  awayTeam: string,
  matchDate: Date | string,
  matchday: number,
  homePosition: number,
  awayPosition: number,
  homeLastMatch?: Date | string | null,
  awayLastMatch?: Date | string | null
): MatchContext {
  const derby = analyzeDerby(homeTeam, awayTeam);
  const promotedTeams = analyzePromotedTeams(homeTeam, awayTeam, matchday);
  const restDays = analyzeRestDays(homeLastMatch || null, awayLastMatch || null, matchDate);
  const seasonStage = analyzeSeasonStage(matchday, homePosition, awayPosition);
  const bigGame = analyzeBigGame(homeTeam, awayTeam, homePosition, awayPosition, matchday);
  const kickoffTime = analyzeKickoffTime(matchDate);
  
  // Aggregate adjustments
  const totalHomeAdjustment = 
    promotedTeams.homeAdjustment +
    restDays.homeAdjustment +
    seasonStage.homeMotivation +
    kickoffTime.homeAdvantageAdjustment;
    
  const totalAwayAdjustment =
    promotedTeams.awayAdjustment +
    restDays.awayAdjustment +
    seasonStage.awayMotivation;
  
  const totalDrawBoost = 
    derby.drawBoost +
    bigGame.drawBoost;
  
  const totalConfidencePenalty =
    derby.confidencePenalty +
    bigGame.confidencePenalty;
  
  // Collect insights
  const keyInsights = [
    derby.insight,
    promotedTeams.insight,
    restDays.insight,
    seasonStage.insight,
    bigGame.insight,
    kickoffTime.insight
  ].filter(i => i.length > 0);
  
  return {
    derby,
    promotedTeams,
    restDays,
    seasonStage,
    bigGame,
    kickoffTime,
    totalHomeAdjustment,
    totalAwayAdjustment,
    totalDrawBoost,
    totalConfidencePenalty,
    keyInsights
  };
}

export default {
  analyzeDerby,
  analyzePromotedTeams,
  analyzeRestDays,
  analyzeSeasonStage,
  analyzeBigGame,
  analyzeKickoffTime,
  getFullMatchContext
};
