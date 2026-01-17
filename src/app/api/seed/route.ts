import { NextResponse } from "next/server";
import seedHistoricalResults from "@/lib/seedHistoricalResults";

/**
 * POST /api/seed - Seed the model with historical match results
 */
export async function POST() {
  try {
    console.log("[API] Starting historical results seeding...");
    
    const result = await seedHistoricalResults(60);
    
    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${result.generated} historical results`,
      data: {
        generated: result.generated,
        accuracy: result.accuracy,
        trend: result.insights.trend,
        calibration: result.insights.byBucket,
        recommendations: result.insights.recommendations,
      },
    });
  } catch (error) {
    console.error("[API] Seed error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to seed historical results",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to seed historical results",
    endpoint: "/api/seed",
    method: "POST",
  });
}
