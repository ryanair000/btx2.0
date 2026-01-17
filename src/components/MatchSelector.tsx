"use client";

import { useState, useMemo } from "react";
import { Match } from "@/types";

// Premier League 2025/26 season has 38 matchdays
const MATCHDAYS = Array.from({ length: 38 }, (_, i) => i + 1);
const CURRENT_MATCHDAY = 22; // Updated current matchday

// Big 6 teams for quick filter
const BIG_SIX = [
  "Arsenal FC",
  "Chelsea FC",
  "Liverpool FC",
  "Manchester City FC",
  "Manchester United FC",
  "Tottenham Hotspur FC",
];

type SortOption = "date" | "home" | "away";

interface MatchSelectorProps {
  matches: Match[];
  selectedMatch: string;
  onSelect: (matchId: string) => void;
  loading: boolean;
  onPredict: () => void;
  isPredicting: boolean;
  error?: string | null;
  matchday: number | null;
  onMatchdayChange: (matchday: number | null) => void;
}

export function MatchSelector({
  matches,
  selectedMatch,
  onSelect,
  loading,
  onPredict,
  isPredicting,
  error,
  matchday,
  onMatchdayChange,
}: MatchSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort matches
  const filteredMatches = useMemo(() => {
    let result = [...matches];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.homeTeam.name.toLowerCase().includes(query) ||
          m.awayTeam.name.toLowerCase().includes(query)
      );
    }

    // Team filter
    if (teamFilter) {
      result = result.filter(
        (m) =>
          m.homeTeam.name === teamFilter || m.awayTeam.name === teamFilter
      );
    }

    // Sort
    switch (sortBy) {
      case "home":
        result.sort((a, b) => a.homeTeam.name.localeCompare(b.homeTeam.name));
        break;
      case "away":
        result.sort((a, b) => a.awayTeam.name.localeCompare(b.awayTeam.name));
        break;
      case "date":
      default:
        result.sort(
          (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
        );
    }

    return result;
  }, [matches, searchQuery, teamFilter, sortBy]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setTeamFilter("");
    setSortBy("date");
  };

  // Get unique teams from current matches
  const teamsInMatches = useMemo(() => {
    const teams = new Set<string>();
    matches.forEach((m) => {
      teams.add(m.homeTeam.name);
      teams.add(m.awayTeam.name);
    });
    return Array.from(teams).sort();
  }, [matches]);

  const selectedMatchData = matches.find((m) => m.id === selectedMatch);

  return (
    <div className="lg:col-span-2">
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Match</h2>
        <p className="text-gray-600 mb-6">
          Choose a Premier League fixture to analyze
        </p>

        {/* Matchday Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Matchday
          </label>
          <select
            value={matchday || ""}
            onChange={(e) => {
              const value = e.target.value;
              onMatchdayChange(value ? parseInt(value, 10) : null);
              onSelect(""); // Reset match selection when matchday changes
              handleClearFilters();
            }}
            className="w-full px-4 py-3 bg-white text-gray-900 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          >
            <option value="">Upcoming Matches</option>
            {MATCHDAYS.map((md) => (
              <option key={md} value={md}>
                Matchday {md} {md === CURRENT_MATCHDAY ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-12 bg-gray-100 rounded-lg animate-pulse"></div>
            <div className="h-12 bg-gray-100 rounded-lg animate-pulse"></div>
            <div className="h-12 bg-gray-100 rounded-lg animate-pulse"></div>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No upcoming matches available</p>
          </div>
        ) : (
          <>
            {/* Search & Filter Toggle */}
            <div className="mb-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Search teams..."
                    className="w-full px-4 py-3 bg-white text-gray-900 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition placeholder-gray-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-3 rounded-lg border transition flex items-center gap-2 ${
                    showFilters || teamFilter
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-md"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>⚙️</span>
                  {(teamFilter || searchQuery) && (
                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  )}
                </button>
              </div>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                {/* Team Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Filter by Team
                  </label>
                  <select
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white text-gray-900 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                  >
                    <option value="">All Teams</option>
                    <optgroup label="Teams in This Matchday">
                      {teamsInMatches.map((team) => (
                        <option key={team} value={team}>
                          {team.replace(" FC", "")}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Sort Options */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
                  <div className="flex gap-2">
                    {[
                      { value: "date", label: "📅 Date" },
                      { value: "home", label: "🏠 Home" },
                      { value: "away", label: "✈️ Away" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setSortBy(option.value as SortOption)}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition ${
                          sortBy === option.value
                            ? "bg-indigo-600 text-white shadow-md"
                            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Team Filters (Big 6) */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Quick Filters (Big 6)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BIG_SIX.map((team) => (
                      <button
                        key={team}
                        onClick={() =>
                          setTeamFilter(teamFilter === team ? "" : team)
                        }
                        className={`px-2 py-1 rounded text-xs transition ${
                          teamFilter === team
                            ? "bg-indigo-600 text-white shadow-md"
                            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {team.replace(" FC", "").slice(0, 3).toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear Filters */}
                {(teamFilter || searchQuery || sortBy !== "date") && (
                  <button
                    onClick={handleClearFilters}
                    className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 transition"
                  >
                    ✕ Clear all filters
                  </button>
                )}
              </div>
            )}

            {/* Match Count */}
            <div className="mb-2 text-xs text-gray-600">
              Showing {filteredMatches.length} of {matches.length} matches
              {teamFilter && ` • ${teamFilter.replace(" FC", "")}`}
            </div>

            {/* Match List with Enhanced Display */}
            {filteredMatches.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                No matches found matching your filters
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto mb-4 space-y-2">
                {filteredMatches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => onSelect(match.id)}
                    className={`w-full p-3 rounded-lg border text-left transition ${
                      selectedMatch === match.id
                        ? "bg-blue-50 border-blue-500 text-gray-900 shadow-sm"
                        : "bg-white border-gray-300 text-gray-900 hover:bg-gray-50 hover:border-gray-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {match.homeTeam.name.replace(" FC", "")}
                          </span>
                          <span className="text-gray-500 text-sm">vs</span>
                          <span className="font-medium">
                            {match.awayTeam.name.replace(" FC", "")}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(match.utcDate).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      {selectedMatch === match.id && (
                        <span className="text-blue-600">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Match Details */}
            {selectedMatchData && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4 border border-blue-200">
                <div className="text-center mb-3">
                  <p className="text-lg font-bold text-gray-900">
                    {selectedMatchData.homeTeam.name.replace(" FC", "")}
                    <span className="text-gray-500 mx-3">vs</span>
                    {selectedMatchData.awayTeam.name.replace(" FC", "")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Date</p>
                    <p className="text-gray-900 font-medium">
                      {new Date(selectedMatchData.utcDate).toLocaleDateString(
                        "en-US",
                        {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Kick-off</p>
                    <p className="text-gray-900 font-medium">
                      {new Date(selectedMatchData.utcDate).toLocaleTimeString(
                        "en-US",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </p>
                  </div>
                </div>
                {selectedMatchData.status !== "SCHEDULED" && (
                  <div className="mt-2 text-center">
                    <span className="px-2 py-1 rounded text-xs bg-amber-50 text-amber-700 border border-amber-300">
                      {selectedMatchData.status}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Predict Button */}
            <button
              onClick={onPredict}
              disabled={isPredicting || !selectedMatch}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold rounded-lg transition transform hover:scale-[1.02] disabled:hover:scale-100 flex items-center justify-center gap-2 text-lg shadow-md hover:shadow-lg disabled:shadow-none"
              title={!selectedMatch ? "Please select a match first" : "Get AI prediction for this match"}
            >
              {isPredicting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Analyzing Match...
                </>
              ) : (
                <>
                  <span>🎯</span>
                  <span>Get AI Prediction</span>
                </>
              )}
            </button>

            {/* Helper text when no match selected */}
            {!selectedMatch && !isPredicting && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm text-center">
                ℹ️ Select a match from the list above to get started
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-300 rounded-lg text-red-700 text-sm">
                <strong>Error:</strong> {error}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-8 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          How it works
        </h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex gap-2">
            <span className="text-blue-600">•</span>
            <span>Real-time data from Premier League</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-600">•</span>
            <span>Analyzes team form, H2H & xG stats</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-600">•</span>
            <span>Betting markets: O/U, BTTS, AH</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-600">•</span>
            <span>Auto-saves predictions to history</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
