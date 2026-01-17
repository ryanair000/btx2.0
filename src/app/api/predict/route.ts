import { NextRequest, NextResponse } from "next/server";
import { AdvancedPredictionEngine, FixtureInput } from "@/lib/advancedPredictionEngine";
import { getUpcomingMatches, getLeagueStandings, getMatchesByMatchday, getMatchHeadToHead } from "@/lib/footballApi";
import { transformMatchToFixture } from "@/lib/dataTransformer";
import {
  validateTeamData,
  checkDataFreshness,
  calculateConfidenceAdjustment,
  validateApiResponse,
} from "@/lib/dataValidator";
import { DeepAnalysisEngine } from "@/lib/deepAnalysis";
import { apiCache } from "@/lib/apiCache";
import { modelAnalytics } from "@/lib/modelAnalytics";
import { getStadiumWeather } from "@/lib/weatherService";
import { applyCalibration, getAccuracyInsights } from "@/lib/modelPersistence";
import { analyzeMatchNews, calculateNewsProbabilityAdjustment } from "@/lib/newsService";

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const body = await request.json();
    const matchId = body?.matchId;
    const matchday = body?.matchday;

    // More robust validation
    if (!matchId || (typeof matchId === "string" && matchId.trim() === "")) {
      return NextResponse.json(
        { error: "Match ID is required. Please select a match." },
        { status: 400 }
      );
    }

    if (typeof matchId !== "string" && typeof matchId !== "number") {
      return NextResponse.json(
        { error: "Invalid match ID format" },
        { status: 400 }
      );
    }

    // Convert to string and trim
    const cleanMatchId = String(matchId).trim();

    // Record when we fetched the data
    const dataFetchTime = Date.now();

    // Fetch real data - use matchday if provided
    const [matches, standings] = await Promise.all([
      matchday ? getMatchesByMatchday(matchday) : getUpcomingMatches(),
      getLeagueStandings(),
    ]);

    // Validate API responses - check if we got data
    if (!Array.isArray(matches) || matches.length === 0) {
      return NextResponse.json(
        { error: "No matches available from API" },
        { status: 502 }
      );
    }

    if (!Array.isArray(standings) || standings.length === 0) {
      return NextResponse.json(
        { error: "No standings data available from API" },
        { status: 502 }
      );
    }

    // Find the selected match
    const match = matches.find((m: any) => m.id.toString() === cleanMatchId);
    if (!match) {
      return NextResponse.json(
        { error: `Match not found. It may no longer be available or has already been played.` },
        { status: 404 }
      );
    }

    // ===== PARALLEL DATA FETCHING =====
    // Fetch H2H, weather, and prepare for news in parallel for better performance
    const venueCity = match.venue?.city || "Manchester";
    
    const [h2hResult, weatherResult] = await Promise.allSettled([
      getMatchHeadToHead(cleanMatchId),
      getStadiumWeather(venueCity, "England"),
    ]);

    // Process H2H result
    let h2hApiData: { aggregates: any; matches: any[] } | null = null;
    if (h2hResult.status === 'fulfilled' && h2hResult.value?.aggregates) {
      h2hApiData = {
        aggregates: h2hResult.value.aggregates,
        matches: h2hResult.value.matches,
      };
    } else if (h2hResult.status === 'rejected') {
      console.warn("[H2H] Failed to fetch H2H data, using fallback:", h2hResult.reason);
    }

    // Transform to fixture input (with H2H data if available)
    const fixture = await transformMatchToFixture(match, standings, h2hApiData ?? undefined);
    if (!fixture) {
      return NextResponse.json(
        { error: "Failed to process match data - insufficient data" },
        { status: 400 }
      );
    }

    // Process weather result
    if (weatherResult.status === 'fulfilled' && weatherResult.value) {
      const weatherData = weatherResult.value;
      fixture.weather = {
        temperature: weatherData.temperature,
        humidity: weatherData.humidity,
        windSpeed: weatherData.windSpeed,
        condition: weatherData.condition,
        rainProbability: weatherData.rainProbability,
      };
      console.log(`[WEATHER] Fetched for ${venueCity}: ${weatherData.condition}, ${weatherData.temperature}°C`);
    } else if (weatherResult.status === 'rejected') {
      console.warn("[WEATHER] Failed to fetch weather, continuing without:", weatherResult.reason);
    }

    // Validate team stats
    const dataValidation = validateTeamData(
      fixture.home_team,
      fixture.away_team,
      standings
    );

    // Check data freshness
    const dataFreshness = checkDataFreshness(dataFetchTime);

    // Calculate confidence adjustment for stale data
    const stalennessAdjustment = calculateConfidenceAdjustment(
      dataFreshness.hoursOld
    );

    // Generate prediction using ADVANCED ENGINE
    const engine = new AdvancedPredictionEngine();
    let prediction = engine.predict(fixture);

    // Validate prediction output
    if (!prediction || !prediction.match) {
      return NextResponse.json(
        { error: "Prediction generation failed" },
        { status: 500 }
      );
    }

    // ===== APPLY CALIBRATION FROM HISTORICAL RESULTS =====
    // This adjusts confidence based on how accurate the model has been
    // in similar confidence ranges historically
    const rawConfidence = prediction.confidence;
    const calibratedConfidence = applyCalibration(rawConfidence);
    const calibrationAdjustment = calibratedConfidence - rawConfidence;
    
    if (calibrationAdjustment !== 0) {
      prediction.confidence = calibratedConfidence;
      prediction.confidenceAdjustment = (prediction.confidenceAdjustment || 0) + calibrationAdjustment;
    }

    // Apply confidence adjustment if data is stale
    if (stalennessAdjustment !== 0) {
      prediction.confidence = Math.max(
        35,
        Math.min(
          90,
          prediction.confidence + stalennessAdjustment
        )
      );
      prediction.confidenceAdjustment = (prediction.confidenceAdjustment || 0) + stalennessAdjustment;
    }

    // Get model accuracy for display
    const insights = getAccuracyInsights();
    if (insights.overall > 0) {
      prediction.modelAccuracy = insights.overall;
    }

    // ===== NEWS ANALYSIS INTEGRATION =====
    // Fetch and analyze news for both teams (non-blocking)
    let newsAnalysis = null;
    try {
      newsAnalysis = await analyzeMatchNews(
        fixture.home_team.name,
        fixture.away_team.name
      );
      
      // Apply news-based probability adjustments
      const newsAdjustments = calculateNewsProbabilityAdjustment(newsAnalysis);
      
      if (prediction.probability) {
        prediction.probability.home += newsAdjustments.homeWinAdjustment;
        prediction.probability.draw += newsAdjustments.drawAdjustment;
        prediction.probability.away += newsAdjustments.awayWinAdjustment;
        
        // Normalize probabilities to sum to 100%
        const total = prediction.probability.home + prediction.probability.draw + prediction.probability.away;
        prediction.probability.home = (prediction.probability.home / total) * 100;
        prediction.probability.draw = (prediction.probability.draw / total) * 100;
        prediction.probability.away = (prediction.probability.away / total) * 100;
      }
      
      // Adjust confidence based on news severity
      const avgConfidenceImpact = (
        newsAnalysis.homeTeamImpact.confidenceImpact + 
        newsAnalysis.awayTeamImpact.confidenceImpact
      ) / 2;
      
      if (avgConfidenceImpact > 0) {
        prediction.confidence = Math.max(30, prediction.confidence - avgConfidenceImpact);
      }
      
      console.log(`[NEWS] Applied adjustments: H+${newsAdjustments.homeWinAdjustment.toFixed(1)}% A+${newsAdjustments.awayWinAdjustment.toFixed(1)}%`);
    } catch (newsError) {
      console.warn('[NEWS] News analysis failed, continuing without:', newsError);
    }

    // Generate deep analysis
    const analyser = new DeepAnalysisEngine();
    const deepAnalysis = analyser.analyze(fixture);

    // Attach freshness, validation, deep analysis, and news info
    prediction.dataFreshness = dataFreshness;
    prediction.dataValidation = dataValidation;
    prediction.deepAnalysis = deepAnalysis;
    if (newsAnalysis) {
      (prediction as any).newsAnalysis = newsAnalysis;
    }

    // Record prediction for analytics with position data
    modelAnalytics.recordPrediction(
      prediction.match,
      prediction.predicted_winner,
      prediction.confidence,
      fixture.home_team.name,
      fixture.away_team.name,
      prediction.probability,
      fixture.home_team.league_position,
      fixture.away_team.league_position
    );

    return NextResponse.json(prediction);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Prediction error:", errorMessage);

    return NextResponse.json(
      {
        error: "Failed to process prediction",
        details:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

