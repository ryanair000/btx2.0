import { NextRequest, NextResponse } from "next/server";
import { apiCache } from "@/lib/apiCache";

export async function GET(request: NextRequest) {
  try {
    const stats = apiCache.getUsageStats();
    const warnings = apiCache.getWarnings();
    const remaining = apiCache.getRemainingQuota();

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      usage: {
        daily: stats.dailyUsage,
        remaining,
        limit: 10, // Free tier
        percentage: Math.round((stats.dailyUsage / 10) * 100),
      },
      stats,
      warnings,
      cacheSize: stats.totalRequests,
      cacheHitRate: `${stats.cacheHitRate.toFixed(1)}%`,
      avgResponseTime: `${stats.averageResponseTime}ms`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to retrieve usage stats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
