export interface Match {
  id: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  utcDate: string;
  status: string;
}

export interface DataFreshness {
  dataTimestamp: number;
  hoursOld: number;
  isStale: boolean;
  staleness: "fresh" | "recent" | "stale" | "very_stale";
  message: string;
}

export interface DataValidation {
  homeTeamValid: boolean;
  awayTeamValid: boolean;
  standingsValid: boolean;
  allValid: boolean;
  issues: string[];
}

export interface OverUnderPrediction {
  line: number;
  overProbability: number;
  underProbability: number;
  recommendation: "OVER" | "UNDER" | "SKIP";
  confidence: number;
  expectedGoals: number;
  insight: string;
}

export interface BTTSPrediction {
  yesProbability: number;
  noProbability: number;
  recommendation: "YES" | "NO" | "SKIP";
  confidence: number;
  homeCleanSheetProb: number;
  awayCleanSheetProb: number;
  insight: string;
}

export interface AsianHandicapPrediction {
  line: number;
  team: "HOME" | "AWAY";
  coverProbability: number;
  recommendation: "BACK" | "SKIP";
  confidence: number;
  expectedMargin: number;
  insight: string;
}

export interface DoubleChancePrediction {
  outcome: "1X" | "X2" | "12";
  probability: number;
  recommendation: "BACK" | "SKIP";
  confidence: number;
  insight: string;
}

export interface CorrectScorePrediction {
  homeGoals: number;
  awayGoals: number;
  probability: number;
}

export interface GoalDistribution {
  goals: number;
  probability: number;
}

export interface BettingMarkets {
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  expectedTotalGoals: number;
  overUnder: OverUnderPrediction[];
  btts: BTTSPrediction;
  asianHandicap: AsianHandicapPrediction[];
  doubleChance: DoubleChancePrediction[];
  topCorrectScores: CorrectScorePrediction[];
  homeGoalDistribution: GoalDistribution[];
  awayGoalDistribution: GoalDistribution[];
  bestBets: string[];
}

export interface PredictionResult {
  match: string;
  predicted_winner: string;
  confidence: number;
  predicted_accuracy: number;
  accuracy_reason: string;
  summary_insight: string;
  key_factors: string[];
  dataFreshness?: DataFreshness;
  dataValidation?: DataValidation;
  confidenceAdjustment?: number;
  weatherInfo?: {
    condition: string;
    impact: string;
    affectsPlay: boolean;
  };
  xgAnalysis?: {
    homeXG: number;
    awayXG: number;
    advantage: string;
    insight: string;
  };
  playerAvailability?: {
    homeStatus: string;
    awayStatus: string;
    insight: string;
  };
  headToHead?: {
    homeWins: number;
    draws: number;
    awayWins: number;
    totalMatches: number;
    dominance: string;
    insight: string;
  };
  deepAnalysis?: {
    formAnalysis: string;
    defensiveStrength: string;
    attackingPower: string;
    headToHeadInsight: string;
    homeAwayDynamics: string;
    matchupMismatches: string[];
    keyBattles: string[];
    possibleOutcomes: string[];
    riskFactors: string[];
    tacticalConsiderations: string;
    injuryImpact: string;
  };
  bettingMarkets?: BettingMarkets;
  marketComparison?: MarketComparison;
  newsAnalysis?: {
    homeTeamImpact: {
      teamName: string;
      sentimentScore: number;
      confidenceImpact: number;
      keyEvents: string[];
      severity: 'low' | 'medium' | 'high' | 'critical';
      newsCount: number;
    };
    awayTeamImpact: {
      teamName: string;
      sentimentScore: number;
      confidenceImpact: number;
      keyEvents: string[];
      severity: 'low' | 'medium' | 'high' | 'critical';
      newsCount: number;
    };
    netAdvantage: number;
    adjustmentRecommendation: string;
  };
}

export interface MarketComparison {
  modelProbability: { home: number; draw: number; away: number };
  marketProbability: { home: number; draw: number; away: number };
  ensembleProbability: { home: number; draw: number; away: number };
  modelVsMarket: {
    homeEdge: number;
    drawEdge: number;
    awayEdge: number;
  };
  valueBets: string[];
  marketWeight: number;
  insight: string;
}

export interface PredictionState {
  predictions: PredictionResult | null;
  loading: boolean;
  error: string | null;
}

export interface MatchesState {
  matches: Match[];
  loading: boolean;
  error: string | null;
  lastUpdated?: number;
}
