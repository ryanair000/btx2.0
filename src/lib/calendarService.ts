/**
 * Premier League Calendar Service
 * Fetches match data from ICS calendar - NO API RATE LIMITS!
 */

interface CalendarMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  utcDate: string;
  status: string;
  venue?: string;
  matchday?: number;
}

// Convert webcal:// to https://
const CALENDAR_URL = "https://ics.ecal.com/ecal-sub/696ac1231375a400028e1203/English%20Premier%20League.ics";

// Cache the calendar data
let calendarCache: CalendarMatch[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 43200000; // 12 hours

/**
 * Parse ICS calendar format
 */
function parseICS(icsData: string): CalendarMatch[] {
  const matches: CalendarMatch[] = [];
  const events = icsData.split('BEGIN:VEVENT');
  
  for (let i = 1; i < events.length; i++) {
    const event = events[i];
    
    // Extract fields
    const summary = event.match(/SUMMARY:(.*)/)?.[1]?.trim() || '';
    const dtstart = event.match(/DTSTART[^:]*:(.*)/)?.[1]?.trim() || '';
    const location = event.match(/LOCATION:(.*)/)?.[1]?.trim() || '';
    const uid = event.match(/UID:(.*)/)?.[1]?.trim() || '';
    
    // Parse team names from summary (format: "Team A vs Team B" or "Team A v Team B")
    const vsMatch = summary.match(/(.+?)\s+(?:vs?\.?|v)\s+(.+?)(?:\s*-\s*.*)?$/i);
    
    if (vsMatch && dtstart) {
      const homeTeam = vsMatch[1].trim();
      const awayTeam = vsMatch[2].trim();
      
      // Parse date (format: YYYYMMDDTHHMMSSZ or YYYYMMDD)
      let dateStr = dtstart.replace(/[TZ]/g, '');
      if (dateStr.length === 8) dateStr += '000000'; // Add time if missing
      
      const year = dateStr.slice(0, 4);
      const month = dateStr.slice(4, 6);
      const day = dateStr.slice(6, 8);
      const hour = dateStr.slice(8, 10) || '00';
      const minute = dateStr.slice(10, 12) || '00';
      
      const utcDate = `${year}-${month}-${day}T${hour}:${minute}:00Z`;
      const matchDate = new Date(utcDate);
      const now = new Date();
      
      // Determine status
      let status = 'SCHEDULED';
      if (matchDate < now) {
        const hoursSince = (now.getTime() - matchDate.getTime()) / (1000 * 60 * 60);
        status = hoursSince > 3 ? 'FINISHED' : 'IN_PLAY';
      }
      
      matches.push({
        id: uid.split('@')[0] || `match_${matches.length}`,
        homeTeam,
        awayTeam,
        utcDate,
        status,
        venue: location || undefined,
      });
    }
  }
  
  return matches.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
}

/**
 * Fetch matches from calendar
 */
export async function getMatchesFromCalendar(): Promise<CalendarMatch[]> {
  const now = Date.now();
  
  // Return cache if valid
  if (calendarCache && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('[CALENDAR] Using cached data');
    return calendarCache;
  }
  
  try {
    console.log('[CALENDAR] Fetching from ICS...');
    const response = await fetch(CALENDAR_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Calendar fetch failed: ${response.status}`);
    }
    
    const icsData = await response.text();
    calendarCache = parseICS(icsData);
    cacheTimestamp = now;
    
    console.log(`[CALENDAR] ✓ Loaded ${calendarCache.length} matches`);
    return calendarCache;
  } catch (error) {
    console.error('[CALENDAR] Error:', error);
    
    // Return cache even if expired, better than nothing
    if (calendarCache) {
      console.log('[CALENDAR] Using expired cache as fallback');
      return calendarCache;
    }
    
    throw error;
  }
}

/**
 * Get upcoming matches
 */
export async function getUpcomingMatchesFromCalendar(limit = 10): Promise<CalendarMatch[]> {
  const allMatches = await getMatchesFromCalendar();
  const now = new Date();
  
  return allMatches
    .filter(m => m.status === 'SCHEDULED' && new Date(m.utcDate) > now)
    .slice(0, limit);
}

/**
 * Get matches by date range
 */
export async function getMatchesByDateRange(startDate: Date, endDate: Date): Promise<CalendarMatch[]> {
  const allMatches = await getMatchesFromCalendar();
  
  return allMatches.filter(m => {
    const matchDate = new Date(m.utcDate);
    return matchDate >= startDate && matchDate <= endDate;
  });
}

/**
 * Estimate matchday from date
 */
function estimateMatchday(date: Date): number {
  const seasonStart = new Date('2024-08-16'); // 2024/25 season start
  const daysSinceStart = Math.floor((date.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
  const weeksSinceStart = Math.floor(daysSinceStart / 7);
  return Math.min(38, Math.max(1, weeksSinceStart + 1));
}

/**
 * Get matches by matchday (approximate)
 */
export async function getMatchesByMatchdayFromCalendar(matchday: number): Promise<CalendarMatch[]> {
  const allMatches = await getMatchesFromCalendar();
  
  // Group matches by week and assign matchdays
  const matchesWithMatchday = allMatches.map(m => ({
    ...m,
    matchday: estimateMatchday(new Date(m.utcDate)),
  }));
  
  return matchesWithMatchday.filter(m => m.matchday === matchday);
}
