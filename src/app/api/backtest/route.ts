import { NextRequest, NextResponse } from "next/server";
import { modelAnalytics } from "@/lib/modelAnalytics";

/**
 * GET /api/backtest - Get backtesting summary and statistics
 * POST /api/backtest - Record match results for backtesting
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format");

    if (format === "csv") {
      // Export as CSV
      const csv = modelAnalytics.exportPredictions();
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=predictions.csv",
        },
      });
    }

    // Return full backtesting summary
    const summary = modelAnalytics.getDashboardSummary();
    const bucketStats = modelAnalytics.getConfidenceBucketStats();
    const matchTypeStats = modelAnalytics.getMatchTypeStats();
    const positionStats = modelAnalytics.getPositionDiffStats();
    const pending = modelAnalytics.getPendingPredictions();
    const calibrationFactors = modelAnalytics.getCalibrationFactors();

    return NextResponse.json({
      success: true,
      data: {
        overview: summary.metrics,
        health: summary.health,
        
        // Confidence bucket analysis
        confidenceBuckets: bucketStats,
        calibrationFactors,
        
        // Match type analysis
        matchTypeStats,
        
        // Position difference analysis
        positionStats,
        
        // Recent and pending
        recentPredictions: summary.recent,
        pendingResults: pending.map(p => ({
          id: p.id,
          match: p.match,
          predicted: p.predicted,
          confidence: p.confidence,
          timestamp: p.timestamp,
          homeTeam: p.homeTeam,
          awayTeam: p.awayTeam,
        })),
        
        // Insights
        insights: generateInsights(bucketStats, matchTypeStats, positionStats),
      },
    });
  } catch (error) {
    console.error("Backtest GET error:", error);
    return NextResponse.json(
      { error: "Failed to get backtest data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle single result
    if (body.match && body.actual) {
      const success = modelAnalytics.recordResult(body.match, body.actual);
      if (success) {
        return NextResponse.json({
          success: true,
          message: `Result recorded: ${body.match} → ${body.actual}`,
        });
      } else {
        return NextResponse.json(
          { error: "Match not found in predictions" },
          { status: 404 }
        );
      }
    }
    
    // Handle bulk results
    if (Array.isArray(body.results)) {
      const { imported, failed } = modelAnalytics.importResults(body.results);
      return NextResponse.json({
        success: true,
        message: `Imported ${imported} results, ${failed} failed`,
        imported,
        failed,
      });
    }

    // Handle calibration update
    if (body.action === "recalibrate") {
      modelAnalytics.updateCalibration();
      return NextResponse.json({
        success: true,
        message: "Calibration updated",
        calibrationFactors: modelAnalytics.getCalibrationFactors(),
      });
    }

    // Handle sync from user results (localStorage data)
    if (body.action === "sync" && Array.isArray(body.userPredictions)) {
      const result = modelAnalytics.syncUserResults(body.userPredictions);
      return NextResponse.json({
        success: true,
        message: `Synced ${result.synced} results, ${result.skipped} skipped`,
        ...result,
      });
    }

    // Handle manual calibration
    if (body.calibrationFactors) {
      modelAnalytics.setCalibrationFactors(body.calibrationFactors);
      return NextResponse.json({
        success: true,
        message: "Calibration factors set",
        calibrationFactors: modelAnalytics.getCalibrationFactors(),
      });
    }

    // Handle clear history
    if (body.action === "clear") {
      modelAnalytics.clearHistory();
      return NextResponse.json({
        success: true,
        message: "History cleared",
      });
    }

    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Backtest POST error:", error);
    return NextResponse.json(
      { error: "Failed to process backtest request" },
      { status: 500 }
    );
  }
}

/**
 * Generate actionable insights from backtesting data
 */
function generateInsights(
  bucketStats: Record<string, any>,
  matchTypeStats: Record<string, any>,
  positionStats: Record<string, any>
): string[] {
  const insights: string[] = [];

  // Check confidence calibration
  Object.entries(bucketStats).forEach(([bucket, stats]: [string, any]) => {
    if (stats.total >= 5) {
      const error = stats.calibrationError;
      if (error > 10) {
        insights.push(`⚠️ ${bucket}% confidence overestimates by ~${error}% - consider reducing`);
      } else if (error < -10) {
        insights.push(`📈 ${bucket}% confidence underestimates by ~${Math.abs(error)}% - could increase`);
      } else if (Math.abs(error) <= 5) {
        insights.push(`✓ ${bucket}% confidence is well-calibrated`);
      }
    }
  });

  // Check match type performance
  if (matchTypeStats.underdog_pick?.total >= 3) {
    if (matchTypeStats.underdog_pick.accuracy < 30) {
      insights.push(`⚠️ Underdog picks hitting only ${matchTypeStats.underdog_pick.accuracy}% - avoid against the odds`);
    } else if (matchTypeStats.underdog_pick.accuracy > 50) {
      insights.push(`✓ Underdog picks at ${matchTypeStats.underdog_pick.accuracy}% - finding value`);
    }
  }

  if (matchTypeStats.home_favorite?.total >= 5) {
    if (matchTypeStats.home_favorite.accuracy > 70) {
      insights.push(`✓ Home favorites at ${matchTypeStats.home_favorite.accuracy}% - reliable category`);
    }
  }

  // Check position-based performance
  if (positionStats.large_home_fav?.total >= 5 && positionStats.large_home_fav.accuracy > 75) {
    insights.push(`✓ Large home favorites (5+ position gap) at ${positionStats.large_home_fav.accuracy}%`);
  }

  if (positionStats.even_match?.total >= 5 && positionStats.even_match.accuracy < 40) {
    insights.push(`⚠️ Even matches only ${positionStats.even_match.accuracy}% - hardest to predict`);
  }

  return insights;
}
