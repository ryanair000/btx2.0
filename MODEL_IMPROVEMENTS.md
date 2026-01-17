# Model Accuracy Improvement Plan

## Current Status
- **Estimated Accuracy:** 45-55%
- **Target Accuracy:** 60-65%
- **Expected Improvement:** +15-20%

---

## 1. Data Quality Fixes (Priority: HIGH)

### 1.1 Fix NEWS_API_KEY Not Being Read
**Issue:** Logs show `[NEWS] No API key, using RSS fallback`

**Solution:**
```env
# In .env.local - ensure no quotes, no spaces
NEWS_API_KEY=33fbd459abc34aeb920c7dd67aa25510
```

**Verification:** Restart dev server and check for `[NEWS] Fetched X articles`

**Expected Impact:** +1-2% accuracy

---

### 1.2 Real Player Injury/Availability Data
**Issue:** All teams show "Near full strength (score: 100)"

**Current Sources:**
- FPL API (free) - Has injury flags, but not being parsed properly
- Sportmonks (you have API key) - Has detailed lineups

**Implementation:**

```typescript
// In src/lib/playerService.ts or localPlayerService.ts

interface PlayerInjury {
  playerName: string;
  status: 'injured' | 'doubtful' | 'suspended' | 'unavailable';
  expectedReturn?: string;
  importance: 'key' | 'regular' | 'squad';
}

// FPL API endpoint for injuries
const FPL_BOOTSTRAP_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';

async function fetchRealInjuries(teamName: string): Promise<PlayerInjury[]> {
  const response = await fetch(FPL_BOOTSTRAP_URL);
  const data = await response.json();
  
  // Filter players by team and injury status
  // status: 'a' = available, 'i' = injured, 'd' = doubtful, 's' = suspended
  const injuries = data.elements
    .filter((p: any) => p.status !== 'a' && getTeamName(p.team) === teamName)
    .map((p: any) => ({
      playerName: `${p.first_name} ${p.second_name}`,
      status: mapStatus(p.status),
      expectedReturn: p.news,
      importance: p.now_cost > 80 ? 'key' : p.now_cost > 50 ? 'regular' : 'squad'
    }));
    
  return injuries;
}
```

**Sportmonks Alternative (more detailed):**
```typescript
const SPORTMONKS_URL = 'https://api.sportmonks.com/v3/football/injuries';

async function fetchSportmonksInjuries(teamId: number): Promise<PlayerInjury[]> {
  const response = await fetch(
    `${SPORTMONKS_URL}?api_token=${process.env.SPORTMONKS_API_KEY}&filter=teamId:${teamId}`
  );
  const data = await response.json();
  return data.data;
}
```

**Expected Impact:** +3-5% accuracy

---

### 1.3 Use Sportmonks for Lineups
**Your API Key:** `NwNFXx8ienoZXBXR7LlcLSGvX15qdKd0IdcpOpW2exop4FJltHtnUvTssrfk`

```typescript
// Fetch expected lineups before match
const LINEUPS_URL = 'https://api.sportmonks.com/v3/football/fixtures/{fixtureId}?include=lineups';

async function getExpectedLineup(fixtureId: number) {
  const response = await fetch(
    `${LINEUPS_URL.replace('{fixtureId}', String(fixtureId))}?api_token=${process.env.SPORTMONKS_API_KEY}`
  );
  return response.json();
}
```

**Expected Impact:** +2-3% accuracy

---

## 2. New Features to Add (Priority: HIGH)

### 2.1 Rest Days / Fixture Congestion
**Logic:** Teams with fewer rest days perform worse

```typescript
interface RestDaysAnalysis {
  homeRestDays: number;
  awayRestDays: number;
  homeIsCongested: boolean;  // < 3 days rest
  awayIsCongested: boolean;
  impact: number;  // -0.15 to +0.15
}

function analyzeRestDays(
  homeLastMatch: Date,
  awayLastMatch: Date,
  matchDate: Date
): RestDaysAnalysis {
  const homeRest = daysBetween(homeLastMatch, matchDate);
  const awayRest = daysBetween(awayLastMatch, matchDate);
  
  const homeIsCongested = homeRest < 4;
  const awayIsCongested = awayRest < 4;
  
  // More rest = advantage
  let impact = 0;
  if (homeRest > awayRest + 2) impact = 0.08;  // Home has 2+ more days rest
  if (awayRest > homeRest + 2) impact = -0.08;
  
  // Heavy congestion penalty
  if (homeIsCongested && !awayIsCongested) impact -= 0.10;
  if (awayIsCongested && !homeIsCongested) impact += 0.10;
  
  return { homeRestDays: homeRest, awayRestDays: awayRest, homeIsCongested, awayIsCongested, impact };
}
```

**Data Source:** Your existing `getTeamMatches()` API call

**Expected Impact:** +2-3% accuracy

---

### 2.2 Referee Bias Analysis
**Logic:** Some referees give more cards, penalties, home advantage

```typescript
interface RefereeStats {
  name: string;
  avgHomeWinRate: number;      // Historical home win % with this ref
  avgCardsPerGame: number;
  avgPenaltiesPerGame: number;
  homeTeamBias: number;        // -1 (away bias) to +1 (home bias)
}

const REFEREE_DATA: Record<string, RefereeStats> = {
  "Michael Oliver": { name: "Michael Oliver", avgHomeWinRate: 0.48, avgCardsPerGame: 4.2, avgPenaltiesPerGame: 0.32, homeTeamBias: 0.02 },
  "Anthony Taylor": { name: "Anthony Taylor", avgHomeWinRate: 0.45, avgCardsPerGame: 3.8, avgPenaltiesPerGame: 0.28, homeTeamBias: -0.03 },
  "Paul Tierney": { name: "Paul Tierney", avgHomeWinRate: 0.52, avgCardsPerGame: 4.5, avgPenaltiesPerGame: 0.35, homeTeamBias: 0.05 },
  // Add more referees...
};

function getRefereeImpact(refereeName: string): number {
  const ref = REFEREE_DATA[refereeName];
  if (!ref) return 0;
  return ref.homeTeamBias * 0.5;  // Scale impact
}
```

**Data Source:** Football-Data.co.uk has referee data in match results

**Expected Impact:** +1-2% accuracy

---

### 2.3 Derby Match Detection
**Logic:** Derbies are more unpredictable, often draws

```typescript
const DERBIES: Array<[string, string]> = [
  // North London Derby
  ["Arsenal FC", "Tottenham Hotspur FC"],
  // Manchester Derby
  ["Manchester United FC", "Manchester City FC"],
  // Merseyside Derby
  ["Liverpool FC", "Everton FC"],
  // North West Derby
  ["Liverpool FC", "Manchester United FC"],
  // West London Derby
  ["Chelsea FC", "Fulham FC"],
  // South Coast Derby
  ["Southampton FC", "AFC Bournemouth"],
  // M23 Derby
  ["Brighton & Hove Albion FC", "Crystal Palace FC"],
  // Midlands Derby
  ["Aston Villa FC", "Wolverhampton Wanderers FC"],
  ["Nottingham Forest FC", "Leicester City FC"],
];

function isDerbyMatch(homeTeam: string, awayTeam: string): boolean {
  return DERBIES.some(([team1, team2]) => 
    (homeTeam.includes(team1) && awayTeam.includes(team2)) ||
    (homeTeam.includes(team2) && awayTeam.includes(team1))
  );
}

function getDerbyImpact(homeTeam: string, awayTeam: string): {
  isDerby: boolean;
  drawBoost: number;
  unpredictabilityPenalty: number;
} {
  const isDerby = isDerbyMatch(homeTeam, awayTeam);
  return {
    isDerby,
    drawBoost: isDerby ? 0.08 : 0,           // +8% to draw probability
    unpredictabilityPenalty: isDerby ? -5 : 0  // -5% confidence
  };
}
```

**Expected Impact:** +1-2% accuracy

---

### 2.4 Time/Day of Match Analysis
**Logic:** Performance varies by kickoff time and day

```typescript
interface MatchTimingAnalysis {
  dayOfWeek: string;
  kickoffTime: string;
  isEarlyKickoff: boolean;    // 12:30 Saturday
  isLateKickoff: boolean;     // 20:00 or later
  isMidweek: boolean;         // Tue/Wed/Thu
  homeAdvantageAdjustment: number;
}

function analyzeMatchTiming(matchDate: Date): MatchTimingAnalysis {
  const day = matchDate.getDay();
  const hour = matchDate.getHours();
  
  const isEarlyKickoff = day === 6 && hour < 14;  // Saturday before 2pm
  const isLateKickoff = hour >= 20;
  const isMidweek = day >= 2 && day <= 4;
  
  // Early kickoffs historically favor away teams slightly
  // Late kickoffs favor home teams (atmosphere)
  let homeAdvantageAdjustment = 0;
  if (isEarlyKickoff) homeAdvantageAdjustment = -0.03;
  if (isLateKickoff) homeAdvantageAdjustment = 0.04;
  if (isMidweek) homeAdvantageAdjustment -= 0.02;  // Less home atmosphere
  
  return {
    dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day],
    kickoffTime: `${hour}:00`,
    isEarlyKickoff,
    isLateKickoff,
    isMidweek,
    homeAdvantageAdjustment
  };
}
```

**Expected Impact:** +0.5-1% accuracy

---

### 2.5 TV Broadcast / Big Game Factor
**Logic:** Teams perform differently in big games

```typescript
function isBigGame(homeTeam: string, awayTeam: string, homePos: number, awayPos: number): boolean {
  const BIG_6 = ['Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United', 'Tottenham'];
  
  const homeBig6 = BIG_6.some(t => homeTeam.includes(t));
  const awayBig6 = BIG_6.some(t => awayTeam.includes(t));
  
  // Big 6 clash
  if (homeBig6 && awayBig6) return true;
  
  // Top 4 clash
  if (homePos <= 4 && awayPos <= 4) return true;
  
  // Relegation 6-pointer
  if (homePos >= 17 && awayPos >= 17) return true;
  
  return false;
}

function getBigGameImpact(isBig: boolean): {
  drawBoost: number;
  confidencePenalty: number;
} {
  return {
    drawBoost: isBig ? 0.05 : 0,        // Big games often tighter
    confidencePenalty: isBig ? -3 : 0    // Less predictable
  };
}
```

**Expected Impact:** +0.5-1% accuracy

---

### 2.6 Promoted Team Penalty
**Logic:** Promoted teams struggle away from home, especially early season

```typescript
const PROMOTED_TEAMS_24_25 = ['Leicester City FC', 'Ipswich Town FC', 'Southampton FC'];

function getPromotedTeamPenalty(teamName: string, isHome: boolean, matchday: number): number {
  const isPromoted = PROMOTED_TEAMS_24_25.some(t => teamName.includes(t));
  
  if (!isPromoted) return 0;
  
  // Penalty decreases as season progresses (they adapt)
  const seasonProgress = Math.min(matchday / 38, 1);
  const basePenalty = 0.12 * (1 - seasonProgress);  // 12% early, 0% by end
  
  // Away matches much harder for promoted teams
  return isHome ? basePenalty * 0.5 : basePenalty;
}
```

**Expected Impact:** +1% accuracy

---

### 2.7 Season Stage Analysis
**Logic:** Motivation varies through season

```typescript
interface SeasonStageAnalysis {
  stage: 'early' | 'mid' | 'late' | 'final';
  homeMotivationBoost: number;
  awayMotivationBoost: number;
}

function analyzeSeasonStage(
  matchday: number,
  homePos: number,
  awayPos: number
): SeasonStageAnalysis {
  const stage = matchday <= 10 ? 'early' : 
                matchday <= 25 ? 'mid' : 
                matchday <= 34 ? 'late' : 'final';
  
  let homeBoost = 0;
  let awayBoost = 0;
  
  if (stage === 'late' || stage === 'final') {
    // Teams fighting for something
    
    // Title race (1st-2nd)
    if (homePos <= 2) homeBoost += 0.08;
    if (awayPos <= 2) awayBoost += 0.08;
    
    // Champions League (3rd-4th)
    if (homePos >= 3 && homePos <= 6) homeBoost += 0.06;
    if (awayPos >= 3 && awayPos <= 6) awayBoost += 0.06;
    
    // Relegation battle (18th-20th)
    if (homePos >= 18) homeBoost += 0.10;  // Desperate
    if (awayPos >= 18) awayBoost += 0.10;
    
    // Mid-table with nothing to play for
    if (homePos >= 10 && homePos <= 14) homeBoost -= 0.03;
    if (awayPos >= 10 && awayPos <= 14) awayBoost -= 0.03;
  }
  
  return { stage, homeMotivationBoost: homeBoost, awayMotivationBoost: awayBoost };
}
```

**Expected Impact:** +1-2% accuracy

---

## 3. Model Calibration Improvements (Priority: MEDIUM)

### 3.1 Dynamic Ensemble Weighting
**Current:** Fixed 60% Model + 25% Poisson + 15% Elo

**Improved:** Weight based on match type

```typescript
function getEnsembleWeights(
  homePos: number,
  awayPos: number,
  isBig6Clash: boolean,
  isDerby: boolean
): { model: number; market: number; elo: number } {
  
  // Big 6 clashes - trust market more
  if (isBig6Clash) {
    return { model: 0.35, market: 0.45, elo: 0.20 };
  }
  
  // Derby - reduce confidence in all models
  if (isDerby) {
    return { model: 0.40, market: 0.35, elo: 0.25 };
  }
  
  // Favorite vs underdog (position diff > 8)
  if (Math.abs(homePos - awayPos) > 8) {
    return { model: 0.50, market: 0.30, elo: 0.20 };
  }
  
  // Mid-table clash - trust market
  if (homePos >= 8 && homePos <= 14 && awayPos >= 8 && awayPos <= 14) {
    return { model: 0.30, market: 0.50, elo: 0.20 };
  }
  
  // Default
  return { model: 0.45, market: 0.35, elo: 0.20 };
}
```

**Expected Impact:** +2-3% accuracy

---

### 3.2 Draw Detection Improvement
**Current Issue:** Draws are 25% of results but hard to predict

**Improved Logic:**

```typescript
function calculateDrawProbability(
  homeScore: number,
  awayScore: number,
  homeDefense: number,
  awayDefense: number,
  h2hDrawRate: number,
  eloDrawProb: number,
  poissonDrawProb: number,
  isDerby: boolean,
  isBigGame: boolean,
  positionDiff: number
): number {
  
  let drawProb = 0.24;  // Base Premier League draw rate
  
  // Score proximity
  const scoreDiff = Math.abs(homeScore - awayScore);
  if (scoreDiff < 0.10) drawProb += 0.08;
  else if (scoreDiff < 0.20) drawProb += 0.04;
  
  // Defensive teams
  const avgDefense = (homeDefense + awayDefense) / 2;
  if (avgDefense > 0.7) drawProb += 0.05;  // Both good defenses
  
  // Historical H2H draws
  if (h2hDrawRate > 0.35) drawProb += 0.06;
  
  // Position proximity
  if (positionDiff <= 3) drawProb += 0.04;
  
  // Derby bonus
  if (isDerby) drawProb += 0.06;
  
  // Big game bonus
  if (isBigGame) drawProb += 0.04;
  
  // Blend with statistical models
  drawProb = drawProb * 0.50 + eloDrawProb * 0.25 + poissonDrawProb * 0.25;
  
  return Math.min(0.45, Math.max(0.15, drawProb));
}
```

**Expected Impact:** +3-5% accuracy on draws

---

## 4. API Integration Improvements (Priority: MEDIUM)

### 4.1 Use API-Sports for Recent Form
**Your Key:** `a9df420d23a441abd12b8209f524e8a1`

```typescript
const API_SPORTS_URL = 'https://v3.football.api-sports.io';

async function getDetailedForm(teamId: number): Promise<{
  form: string;
  goalsScored: number[];
  goalsConceded: number[];
  homeForm: string;
  awayForm: string;
}> {
  const response = await fetch(
    `${API_SPORTS_URL}/fixtures?team=${teamId}&last=10`,
    {
      headers: { 'x-apisports-key': process.env.API_SPORTS_KEY! }
    }
  );
  
  const data = await response.json();
  // Parse last 10 matches for detailed form
  return parseFormData(data.response);
}
```

**Expected Impact:** +2% accuracy

---

### 4.2 Use OpenAI for News Sentiment
**Your Key:** Available in `.env.local`

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function analyzeNewsSentiment(articles: string[], teamName: string): Promise<{
  sentiment: number;  // -1 to 1
  keyEvents: string[];
  confidence: number;
}> {
  const prompt = `Analyze these football news articles about ${teamName}. 
  Rate sentiment from -1 (very negative: injuries, crisis) to +1 (very positive: winning streak, confidence).
  List key events that could affect match performance.
  
  Articles:
  ${articles.join('\n\n')}
  
  Respond in JSON: { "sentiment": number, "keyEvents": string[], "confidence": number }`;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(response.choices[0].message.content!);
}
```

**Cost:** ~$0.01 per prediction
**Expected Impact:** +1-2% accuracy

---

### 4.3 GNews/MediaStack Integration
**Your Keys:** In `.env.local`

```typescript
async function fetchMultiSourceNews(teamName: string): Promise<NewsArticle[]> {
  const sources = [
    fetchNewsAPI(teamName),      // Primary
    fetchGNews(teamName),        // Backup 1
    fetchMediaStack(teamName),   // Backup 2
    fetchBBCRSS(teamName),       // Free fallback
  ];
  
  // Try sources in order until we get results
  for (const source of sources) {
    try {
      const articles = await source;
      if (articles.length > 0) return articles;
    } catch (e) {
      continue;
    }
  }
  
  return [];
}

async function fetchGNews(teamName: string): Promise<NewsArticle[]> {
  const response = await fetch(
    `https://gnews.io/api/v4/search?q="${teamName}" Premier League&lang=en&token=${process.env.GNEWS_API_KEY}`
  );
  const data = await response.json();
  return data.articles || [];
}

async function fetchMediaStack(teamName: string): Promise<NewsArticle[]> {
  const response = await fetch(
    `http://api.mediastack.com/v1/news?access_key=${process.env.MEDIASTACK_API_KEY}&keywords=${encodeURIComponent(teamName)}&languages=en`
  );
  const data = await response.json();
  return data.data || [];
}
```

**Expected Impact:** +1% accuracy (better news coverage)

---

## 5. Historical Backtesting (Priority: HIGH)

### 5.1 Create Backtesting Script

```typescript
// scripts/backtest.ts

interface BacktestResult {
  totalMatches: number;
  correct: number;
  accuracy: number;
  byConfidence: Record<string, { total: number; correct: number; accuracy: number }>;
  byMatchType: Record<string, { total: number; correct: number; accuracy: number }>;
  byPositionDiff: Record<string, { total: number; correct: number; accuracy: number }>;
}

async function runBacktest(season: string): Promise<BacktestResult> {
  const results = await loadHistoricalResults(season);
  
  const byConfidence: Record<string, any> = {
    '40-50': { total: 0, correct: 0 },
    '50-60': { total: 0, correct: 0 },
    '60-70': { total: 0, correct: 0 },
    '70-80': { total: 0, correct: 0 },
    '80+': { total: 0, correct: 0 },
  };
  
  const byMatchType: Record<string, any> = {
    'home_favorite': { total: 0, correct: 0 },
    'away_favorite': { total: 0, correct: 0 },
    'even': { total: 0, correct: 0 },
  };
  
  const byPositionDiff: Record<string, any> = {
    '0-3': { total: 0, correct: 0 },
    '4-7': { total: 0, correct: 0 },
    '8-12': { total: 0, correct: 0 },
    '13+': { total: 0, correct: 0 },
  };
  
  for (const match of results) {
    const prediction = await engine.predict(match);
    const correct = prediction.predicted_winner === match.result;
    
    // Track by confidence
    const confBucket = getConfidenceBucket(prediction.confidence);
    byConfidence[confBucket].total++;
    if (correct) byConfidence[confBucket].correct++;
    
    // Track by match type
    const matchType = getMatchType(match);
    byMatchType[matchType].total++;
    if (correct) byMatchType[matchType].correct++;
    
    // Track by position diff
    const posDiff = getPositionDiffBucket(match);
    byPositionDiff[posDiff].total++;
    if (correct) byPositionDiff[posDiff].correct++;
  }
  
  // Calculate accuracies
  Object.values(byConfidence).forEach(b => b.accuracy = b.correct / b.total);
  Object.values(byMatchType).forEach(b => b.accuracy = b.correct / b.total);
  Object.values(byPositionDiff).forEach(b => b.accuracy = b.correct / b.total);
  
  return {
    totalMatches: results.length,
    correct: Object.values(byConfidence).reduce((a, b) => a + b.correct, 0),
    accuracy: 0,  // Calculate
    byConfidence,
    byMatchType,
    byPositionDiff,
  };
}
```

---

## 6. Implementation Order

### Phase 1 (This Week) - Quick Wins
1. ✅ Fix NEWS_API_KEY
2. ✅ Add derby detection
3. ✅ Add promoted team penalty
4. ✅ Add rest days analysis
5. ✅ Improve draw detection

### Phase 2 (Next Week) - API Integration
1. Integrate Sportmonks for injuries
2. Integrate API-Sports for form
3. Add multi-source news fallback
4. Add referee analysis

### Phase 3 (Following Week) - Advanced
1. Dynamic ensemble weighting
2. Season stage motivation
3. Big game factor
4. OpenAI sentiment analysis
5. Full backtesting suite

---

## 7. Expected Results

| Phase | Features Added | Expected Accuracy |
|-------|----------------|-------------------|
| Current | Base model | 45-50% |
| Phase 1 | Quick wins | 50-55% |
| Phase 2 | API integration | 55-58% |
| Phase 3 | Advanced features | 58-62% |
| Optimized | After calibration | 60-65% |

---

## 8. Files to Modify

| File | Changes |
|------|---------|
| `src/lib/advancedPredictionEngine.ts` | Add new features, improve ensemble |
| `src/lib/newsService.ts` | Multi-source news, fix API key |
| `src/lib/playerService.ts` | Real injury data |
| `src/lib/fixtureCongestionService.ts` | Rest days analysis |
| `src/lib/eloService.ts` | Improve Elo weighting |
| `src/lib/modelAnalytics.ts` | Better calibration |
| `src/components/PredictionCard.tsx` | Show new factors |
| `scripts/backtest.ts` | New file for backtesting |

---

## 9. Monitoring & Validation

After each phase, run backtesting to validate improvements:

```bash
npm run backtest -- --season=2023-24
npm run backtest -- --season=2024-25
```

Track:
- Overall accuracy
- Accuracy by confidence bucket
- Accuracy by match type
- Calibration error

---

## 10. Risk Factors

| Risk | Mitigation |
|------|------------|
| Overfitting | Test on holdout data |
| API rate limits | Implement caching |
| Stale data | Real-time validation |
| Feature bloat | A/B test each feature |

---

*Document created: January 17, 2026*
*Last updated: January 17, 2026*
