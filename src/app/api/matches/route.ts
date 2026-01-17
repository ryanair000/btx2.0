import { NextRequest, NextResponse } from "next/server";
import { getUpcomingMatches, getLeagueStandings, getMatchesByMatchday } from "@/lib/footballApi";

export async function GET(request: NextRequest) {
  try {
    // Check for matchday parameter
    const searchParams = request.nextUrl.searchParams;
    const matchdayParam = searchParams.get("matchday");
    const matchday = matchdayParam ? parseInt(matchdayParam, 10) : null;

    // Fetch data in parallel
    const [matches, standings] = await Promise.all([
      matchday ? getMatchesByMatchday(matchday) : getUpcomingMatches(),
      getLeagueStandings(),
    ]);

    // Validate response
    if (!Array.isArray(matches) || matches.length === 0) {
      console.warn("No matches returned from API");
      return NextResponse.json(
        { 
          error: "No matches available",
          matches: [],
          standings: [],
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      matches: matchday ? matches : matches.slice(0, 10), // Return all for matchday, limit 10 for upcoming
      standings,
      matchday: matchday || null,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch matches";
    console.error("Matches endpoint error:", errorMessage);

    return NextResponse.json(
      {
        error: "Failed to fetch matches",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        matches: [],
      },
      { status: 500 }
    );
  }
}
