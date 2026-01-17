/**
 * Football News Service - Integrates news sentiment and events into predictions
 * 
 * News impacts considered:
 * - Player injuries/suspensions
 * - Manager changes/pressure
 * - Team morale and momentum
 * - Transfer news
 * - Recent controversies
 */

interface NewsArticle {
  title: string;
  description: string;
  content: string;
  source: string;
  publishedAt: string;
  url: string;
}

interface NewsImpact {
  teamName: string;
  sentimentScore: number; // -1 (very negative) to +1 (very positive)
  confidenceImpact: number; // How much to adjust prediction confidence
  keyEvents: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  newsCount: number;
  recentNews: NewsArticle[];
}

interface TeamNewsAnalysis {
  homeTeamImpact: NewsImpact;
  awayTeamImpact: NewsImpact;
  netAdvantage: number; // Positive favors home, negative favors away
  adjustmentRecommendation: string;
}

// Keywords for different news categories
const NEWS_KEYWORDS = {
  injuries: ['injury', 'injured', 'sidelined', 'ruled out', 'fitness', 'doubtful', 'strain', 'out for'],
  suspensions: ['suspended', 'suspension', 'banned', 'red card', 'yellow cards', 'unavailable'],
  form: ['winning streak', 'unbeaten', 'poor form', 'struggling', 'momentum', 'confidence', 'crisis'],
  manager: ['manager', 'coach', 'sacked', 'fired', 'under pressure', 'new boss', 'interim'],
  morale: ['morale', 'dressing room', 'unity', 'discord', 'harmony', 'tension', 'split'],
  transfers: ['signing', 'transfer', 'new player', 'acquisition', 'departure', 'sold'],
};

// NewsAPI configuration (free tier: 100 requests/day)
const NEWS_API_KEY = process.env.NEWS_API_KEY || process.env.NEXT_PUBLIC_NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2/everything';

// Cache news for 6 hours
const newsCache = new Map<string, { data: NewsArticle[]; timestamp: number }>();
const CACHE_TTL = 21600000; // 6 hours

/**
 * Fetch news for a team
 */
async function fetchTeamNews(teamName: string, daysBack = 3): Promise<NewsArticle[]> {
  const cacheKey = `${teamName}_${daysBack}`;
  const cached = newsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[NEWS] Using cached news for ${teamName}`);
    return cached.data;
  }

  // Fallback to free sources if no API key
  if (!NEWS_API_KEY) {
    console.log('[NEWS] No API key, using RSS fallback');
    return fetchNewsFromRSS(teamName);
  }

  try {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);
    
    const searchQuery = `"${teamName}" AND (Premier League OR EPL OR football)`;
    
    const response = await fetch(
      `${NEWS_API_URL}?` + new URLSearchParams({
        q: searchQuery,
        from: fromDate.toISOString(),
        sortBy: 'relevancy',
        language: 'en',
        apiKey: NEWS_API_KEY,
      }),
      { next: { revalidate: 21600 } } // 6 hour cache
    );

    if (!response.ok) {
      console.warn(`[NEWS] API error ${response.status}, using fallback`);
      return fetchNewsFromRSS(teamName);
    }

    const data = await response.json();
    const articles: NewsArticle[] = (data.articles || []).slice(0, 20).map((a: any) => ({
      title: a.title || '',
      description: a.description || '',
      content: a.content || a.description || '',
      source: a.source?.name || 'Unknown',
      publishedAt: a.publishedAt || new Date().toISOString(),
      url: a.url || '',
    }));

    newsCache.set(cacheKey, { data: articles, timestamp: Date.now() });
    console.log(`[NEWS] Fetched ${articles.length} articles for ${teamName}`);
    return articles;
  } catch (error) {
    console.error(`[NEWS] Error fetching news for ${teamName}:`, error);
    return fetchNewsFromRSS(teamName);
  }
}

/**
 * Fallback: Fetch from BBC Sport RSS (always free)
 */
async function fetchNewsFromRSS(teamName: string): Promise<NewsArticle[]> {
  try {
    // BBC Sport RSS feed
    const rssUrl = 'https://feeds.bbci.co.uk/sport/football/rss.xml';
    const response = await fetch(rssUrl);
    const xml = await response.text();
    
    // Simple XML parsing (looking for items)
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const articles: NewsArticle[] = [];
    
    for (const item of items.slice(0, 20)) {
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || '';
      const description = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || '';
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      
      // Check if article mentions the team
      const content = (title + description).toLowerCase();
      const teamLower = teamName.toLowerCase();
      
      if (content.includes(teamLower) || 
          content.includes(teamName.replace(' FC', '').toLowerCase()) ||
          content.includes(teamName.replace(' United', '').toLowerCase())) {
        articles.push({
          title,
          description,
          content: description,
          source: 'BBC Sport',
          publishedAt: pubDate || new Date().toISOString(),
          url: link,
        });
      }
    }
    
    console.log(`[NEWS] Fetched ${articles.length} RSS articles for ${teamName}`);
    return articles;
  } catch (error) {
    console.error('[NEWS] RSS fetch failed:', error);
    return [];
  }
}

/**
 * Analyze sentiment and detect key events
 */
function analyzeNews(articles: NewsArticle[], teamName: string): NewsImpact {
  if (articles.length === 0) {
    return {
      teamName,
      sentimentScore: 0,
      confidenceImpact: 0,
      keyEvents: [],
      severity: 'low',
      newsCount: 0,
      recentNews: [],
    };
  }

  let sentimentScore = 0;
  const keyEvents: string[] = [];
  let totalWeight = 0;

  for (const article of articles) {
    const text = `${article.title} ${article.description} ${article.content}`.toLowerCase();
    let articleSentiment = 0;
    let articleWeight = 1;

    // Age factor (more recent = more weight)
    const age = Date.now() - new Date(article.publishedAt).getTime();
    const daysSince = age / (1000 * 60 * 60 * 24);
    articleWeight = daysSince < 1 ? 2 : (daysSince < 2 ? 1.5 : 1);

    // Check for injuries (very negative)
    if (NEWS_KEYWORDS.injuries.some(kw => text.includes(kw))) {
      articleSentiment -= 0.6;
      if (text.includes('key player') || text.includes('star') || text.includes('captain')) {
        articleSentiment -= 0.3;
        keyEvents.push(`⚠️ Key player injury: ${article.title.substring(0, 80)}`);
      } else {
        keyEvents.push(`🤕 Injury news: ${article.title.substring(0, 80)}`);
      }
    }

    // Check for suspensions (negative)
    if (NEWS_KEYWORDS.suspensions.some(kw => text.includes(kw))) {
      articleSentiment -= 0.5;
      keyEvents.push(`🔴 Suspension: ${article.title.substring(0, 80)}`);
    }

    // Check for form
    if (text.includes('winning streak') || text.includes('unbeaten') || text.includes('momentum')) {
      articleSentiment += 0.4;
      keyEvents.push(`📈 Good form: ${article.title.substring(0, 80)}`);
    }
    if (text.includes('poor form') || text.includes('struggling') || text.includes('crisis')) {
      articleSentiment -= 0.4;
      keyEvents.push(`📉 Poor form: ${article.title.substring(0, 80)}`);
    }

    // Manager issues (significant negative)
    if (text.includes('sacked') || text.includes('fired') || text.includes('under pressure')) {
      articleSentiment -= 0.5;
      keyEvents.push(`👔 Manager pressure: ${article.title.substring(0, 80)}`);
    }
    if (text.includes('new manager') || text.includes('new boss')) {
      articleSentiment += 0.2; // New manager bounce
      keyEvents.push(`🆕 New manager: ${article.title.substring(0, 80)}`);
    }

    // Morale issues
    if (NEWS_KEYWORDS.morale.some(kw => text.includes(kw))) {
      if (text.includes('discord') || text.includes('tension') || text.includes('split')) {
        articleSentiment -= 0.3;
        keyEvents.push(`😟 Morale issues: ${article.title.substring(0, 80)}`);
      } else {
        articleSentiment += 0.2;
      }
    }

    // Positive transfers
    if ((text.includes('signing') || text.includes('new player')) && 
        (text.includes('boost') || text.includes('strengthen'))) {
      articleSentiment += 0.3;
      keyEvents.push(`✅ New signing: ${article.title.substring(0, 80)}`);
    }

    sentimentScore += articleSentiment * articleWeight;
    totalWeight += articleWeight;
  }

  // Normalize sentiment score
  const normalizedSentiment = totalWeight > 0 ? sentimentScore / totalWeight : 0;
  const clampedSentiment = Math.max(-1, Math.min(1, normalizedSentiment));

  // Calculate confidence impact (news volatility affects confidence)
  const confidenceImpact = Math.abs(clampedSentiment) * 5; // Up to ±5%

  // Determine severity
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (Math.abs(clampedSentiment) > 0.6) severity = 'critical';
  else if (Math.abs(clampedSentiment) > 0.4) severity = 'high';
  else if (Math.abs(clampedSentiment) > 0.2) severity = 'medium';

  return {
    teamName,
    sentimentScore: clampedSentiment,
    confidenceImpact,
    keyEvents: keyEvents.slice(0, 5), // Top 5 events
    severity,
    newsCount: articles.length,
    recentNews: articles.slice(0, 3),
  };
}

/**
 * Analyze news for both teams in a match
 */
export async function analyzeMatchNews(
  homeTeam: string,
  awayTeam: string
): Promise<TeamNewsAnalysis> {
  console.log(`[NEWS] Analyzing news for ${homeTeam} vs ${awayTeam}`);

  try {
    // Fetch news for both teams in parallel
    const [homeArticles, awayArticles] = await Promise.all([
      fetchTeamNews(homeTeam),
      fetchTeamNews(awayTeam),
    ]);

    const homeImpact = analyzeNews(homeArticles, homeTeam);
    const awayImpact = analyzeNews(awayArticles, awayTeam);

    // Calculate net advantage (positive = home advantage, negative = away advantage)
    const netAdvantage = homeImpact.sentimentScore - awayImpact.sentimentScore;

    let adjustmentRecommendation = '';
    if (netAdvantage > 0.3) {
      adjustmentRecommendation = `Strong positive news for ${homeTeam}. Consider increasing home win probability by ${Math.round(netAdvantage * 10)}%.`;
    } else if (netAdvantage < -0.3) {
      adjustmentRecommendation = `Strong positive news for ${awayTeam}. Consider increasing away win probability by ${Math.round(Math.abs(netAdvantage) * 10)}%.`;
    } else if (Math.abs(netAdvantage) > 0.1) {
      const favoredTeam = netAdvantage > 0 ? homeTeam : awayTeam;
      adjustmentRecommendation = `Slight news advantage for ${favoredTeam}.`;
    } else {
      adjustmentRecommendation = 'News impact is balanced for both teams.';
    }

    console.log(`[NEWS] Analysis complete. Net advantage: ${netAdvantage.toFixed(2)}`);

    return {
      homeTeamImpact: homeImpact,
      awayTeamImpact: awayImpact,
      netAdvantage,
      adjustmentRecommendation,
    };
  } catch (error) {
    console.error('[NEWS] Analysis failed:', error);
    // Return neutral impact on error
    return {
      homeTeamImpact: {
        teamName: homeTeam,
        sentimentScore: 0,
        confidenceImpact: 0,
        keyEvents: [],
        severity: 'low',
        newsCount: 0,
        recentNews: [],
      },
      awayTeamImpact: {
        teamName: awayTeam,
        sentimentScore: 0,
        confidenceImpact: 0,
        keyEvents: [],
        severity: 'low',
        newsCount: 0,
        recentNews: [],
      },
      netAdvantage: 0,
      adjustmentRecommendation: 'News analysis unavailable.',
    };
  }
}

/**
 * Calculate probability adjustment based on news
 */
export function calculateNewsProbabilityAdjustment(newsAnalysis: TeamNewsAnalysis): {
  homeWinAdjustment: number;
  drawAdjustment: number;
  awayWinAdjustment: number;
} {
  const { netAdvantage } = newsAnalysis;

  // Adjust probabilities based on news sentiment
  // Stronger news impact = bigger probability shift
  const adjustmentMagnitude = Math.abs(netAdvantage) * 8; // Up to ±8% shift

  if (netAdvantage > 0) {
    // Positive for home team
    return {
      homeWinAdjustment: adjustmentMagnitude,
      drawAdjustment: -adjustmentMagnitude / 2,
      awayWinAdjustment: -adjustmentMagnitude / 2,
    };
  } else if (netAdvantage < 0) {
    // Positive for away team
    return {
      homeWinAdjustment: -adjustmentMagnitude / 2,
      drawAdjustment: -adjustmentMagnitude / 2,
      awayWinAdjustment: adjustmentMagnitude,
    };
  }

  return {
    homeWinAdjustment: 0,
    drawAdjustment: 0,
    awayWinAdjustment: 0,
  };
}

export type { TeamNewsAnalysis, NewsImpact, NewsArticle };
