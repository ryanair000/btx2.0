/**
 * API Cache Manager with Usage Monitoring
 * 
 * Features:
 * - In-memory caching with TTL
 * - Usage monitoring and logging
 * - Request deduplication
 * - Smart cache invalidation
 * - Usage quota enforcement
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

interface ApiUsageLog {
  endpoint: string;
  timestamp: number;
  cached: boolean;
  requestId: string;
}

interface UsageStats {
  totalRequests: number;
  cachedRequests: number;
  freshRequests: number;
  averageResponseTime: number;
  dailyUsage: number;
  cacheHitRate: number;
  requestsByEndpoint: Record<string, number>;
}

class ApiCacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private usageLogs: ApiUsageLog[] = [];
  private requestTimings = new Map<string, number[]>();
  private pendingRequests = new Map<string, Promise<any>>();
  
  // Free tier limits (adjust based on your API plan)
  private FREE_TIER_DAILY_LIMIT = 10; // requests per day
  private PREMIUM_TIER_DAILY_LIMIT = 100;
  private currentLimit = 999; // Effectively unlimited - using local fallback

  // Cache TTLs (in milliseconds) - EXTENDED TO REDUCE API CALLS
  private readonly CACHE_TTL = {
    STANDINGS: 86400000, // 24 hours - standings don't change often
    UPCOMING_MATCHES: 43200000, // 12 hours - matches are scheduled in advance
    TEAM_MATCHES: 43200000, // 12 hours
    TEAM_DETAILS: 7200000, // 2 hours
    H2H: 86400000, // 24 hours - H2H history rarely changes
    DEFAULT: 900000, // 15 minutes
  };

  constructor(tier: "free" | "premium" = "free") {
    this.currentLimit = tier === "free" ? this.FREE_TIER_DAILY_LIMIT : this.PREMIUM_TIER_DAILY_LIMIT;
    this.startDailyReset();
  }

  /**
   * Get cached data or undefined if expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache with TTL
   */
  set<T>(key: string, data: T, ttlKey?: keyof typeof this.CACHE_TTL): void {
    const ttl = ttlKey ? this.CACHE_TTL[ttlKey] : this.CACHE_TTL.DEFAULT;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Request deduplication - prevent multiple identical requests
   */
  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // If request already pending, return the same promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Otherwise, make the request and cache the promise
    const promise = requestFn();
    this.pendingRequests.set(key, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Log API usage
   */
  logUsage(endpoint: string, cached: boolean): void {
    this.usageLogs.push({
      endpoint,
      timestamp: Date.now(),
      cached,
      requestId: `${endpoint}-${Date.now()}`,
    });

    console.log(`[API CACHE] ${cached ? "✓ CACHED" : "⚠ FRESH"} - ${endpoint} (Daily: ${this.getDailyUsageCount()}/${this.currentLimit})`);
  }

  /**
   * Check if we're within daily quota
   */
  isWithinQuota(): boolean {
    return this.getDailyUsageCount() < this.currentLimit;
  }

  /**
   * Get today's usage count
   */
  getDailyUsageCount(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    return this.usageLogs.filter(
      (log) => log.timestamp >= todayTimestamp && !log.cached
    ).length;
  }

  /**
   * Get remaining quota
   */
  getRemainingQuota(): number {
    return Math.max(0, this.currentLimit - this.getDailyUsageCount());
  }

  /**
   * Get comprehensive usage statistics
   */
  getUsageStats(): UsageStats {
    const totalRequests = this.usageLogs.length;
    const cachedRequests = this.usageLogs.filter((log) => log.cached).length;
    const freshRequests = totalRequests - cachedRequests;

    const requestsByEndpoint: Record<string, number> = {};
    this.usageLogs.forEach((log) => {
      requestsByEndpoint[log.endpoint] = (requestsByEndpoint[log.endpoint] || 0) + 1;
    });

    const timings = Array.from(this.requestTimings.values()).flat();
    const averageResponseTime = timings.length > 0 
      ? timings.reduce((a, b) => a + b, 0) / timings.length 
      : 0;

    return {
      totalRequests,
      cachedRequests,
      freshRequests,
      averageResponseTime: Math.round(averageResponseTime),
      dailyUsage: this.getDailyUsageCount(),
      cacheHitRate: totalRequests > 0 ? (cachedRequests / totalRequests) * 100 : 0,
      requestsByEndpoint,
    };
  }

  /**
   * Clear all cache (for testing)
   */
  clearCache(): void {
    this.cache.clear();
    console.log("[API CACHE] Cache cleared");
  }

  /**
   * Clear old logs (keep last 7 days)
   */
  private pruneOldLogs(): void {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.usageLogs = this.usageLogs.filter((log) => log.timestamp > sevenDaysAgo);
  }

  /**
   * Reset daily usage counter at midnight
   */
  private startDailyReset(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const timeUntilReset = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      console.log("[API CACHE] Daily usage counter reset");
      this.startDailyReset();
    }, timeUntilReset);
  }

  /**
   * Display usage dashboard
   */
  displayDashboard(): string {
    const stats = this.getUsageStats();
    const remaining = this.getRemainingQuota();
    
    const dashboard = `
╔════════════════════════════════════════════════════════════╗
║                   API USAGE DASHBOARD                      ║
╠════════════════════════════════════════════════════════════╣
║ Daily Usage:        ${stats.dailyUsage}/${this.currentLimit} requests                      ║
║ Remaining Quota:    ${remaining} requests available                ║
║ Total Requests:     ${stats.totalRequests} (${stats.cachedRequests} cached, ${stats.freshRequests} fresh)    ║
║ Cache Hit Rate:     ${stats.cacheHitRate.toFixed(1)}%                         ║
║ Avg Response:       ${stats.averageResponseTime}ms                          ║
║ Cache Size:         ${this.cache.size} entries                       ║
╠════════════════════════════════════════════════════════════╣
║ Requests by Endpoint:                                      ║
${Object.entries(stats.requestsByEndpoint)
  .map(([endpoint, count]) => `║   ${endpoint.padEnd(40)} ${String(count).padStart(8)} ║`)
  .join("\n")}
╚════════════════════════════════════════════════════════════╝
    `;

    return dashboard;
  }

  /**
   * Get usage warnings
   */
  getWarnings(): string[] {
    const warnings: string[] = [];
    const remaining = this.getRemainingQuota();
    const stats = this.getUsageStats();

    if (remaining <= 1) {
      warnings.push("⚠️  CRITICAL: You've reached your daily API quota!");
    } else if (remaining <= 3) {
      warnings.push(`⚠️  WARNING: Only ${remaining} requests remaining today`);
    }

    if (stats.cacheHitRate < 50) {
      warnings.push("💡 TIP: Cache hit rate is low. Consider increasing cache TTL or optimizing requests");
    }

    return warnings;
  }
}

// Export singleton instance
export const apiCache = new ApiCacheManager("free");

// Export class for testing
export { ApiCacheManager };
