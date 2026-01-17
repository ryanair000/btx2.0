import { NextResponse } from "next/server";
import { rebuildCalibrationFromHistory, getAccuracyInsights } from "@/lib/modelPersistence";

export async function POST() {
  try {
    console.log('[API] Forcing calibration rebuild from history...');
    const calibration = rebuildCalibrationFromHistory();
    const insights = getAccuracyInsights();
    
    return NextResponse.json({ 
      success: true, 
      calibration,
      insights,
    });
  } catch (error) {
    console.error('[API] Recalc error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'POST to this endpoint to force recalculation', 
    endpoint: '/api/seed/recalc' 
  });
}
