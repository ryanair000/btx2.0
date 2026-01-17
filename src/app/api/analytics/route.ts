import { NextRequest, NextResponse } from "next/server";
import { modelAnalytics } from "@/lib/modelAnalytics";

export async function GET(request: NextRequest) {
  try {
    const summary = modelAnalytics.getDashboardSummary();
    const recent = modelAnalytics.getRecentPredictions(20);

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      summary,
      recent,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to retrieve model analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    if (action === "record_prediction") {
      modelAnalytics.recordPrediction(
        body.match,
        body.predicted,
        body.confidence,
        body.homeTeam,
        body.awayTeam,
        body.probability
      );
      return NextResponse.json({ success: true, message: "Prediction recorded" });
    }

    if (action === "record_result") {
      modelAnalytics.recordResult(body.matchId, body.actual);
      return NextResponse.json({ success: true, message: "Result recorded" });
    }

    if (action === "export") {
      const csv = modelAnalytics.exportPredictions();
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="predictions.csv"',
        },
      });
    }

    if (action === "clear") {
      modelAnalytics.clearHistory();
      return NextResponse.json({ success: true, message: "History cleared" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
