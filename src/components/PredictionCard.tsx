"use client";

import { PredictionResult, Match } from "@/types";
import { getStalenessWarning } from "@/lib/dataValidator";
import { useState } from "react";
import { SavePredictionButton } from "./UserFeatures";

interface PredictionCardProps {
  predictions: PredictionResult | null;
  selectedMatch?: Match | null;
}

export function PredictionCard({ predictions, selectedMatch }: PredictionCardProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  if (!predictions) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center h-full flex flex-col items-center justify-center shadow-sm">
        <div className="text-6xl mb-4">🎯</div>
        <p className="text-gray-600 text-lg">
          Select a match to see AI-powered predictions
        </p>
        <p className="text-gray-500 text-sm mt-2">
          Real-time analysis powered by Premier League data
        </p>
      </div>
    );
  }

  const stalenessWarning =
    predictions.dataFreshness && getStalenessWarning(predictions.dataFreshness);
  const hasValidationIssues =
    predictions.dataValidation && !predictions.dataValidation.allValid;

  return (
    <div className="space-y-6">
      {/* Data Quality Warnings */}
      {(stalenessWarning || hasValidationIssues) && (
        <div className="space-y-3">
          {stalenessWarning && (
            <div className="bg-yellow-900/30 border border-yellow-600/40 rounded-lg p-4 flex items-start gap-3">
              <span className="text-xl flex-shrink-0">⏱️</span>
              <div className="flex-1">
                <p className="text-yellow-300 font-semibold text-sm">
                  Data Freshness Warning
                </p>
                <p className="text-yellow-200 text-sm mt-1">{stalenessWarning}</p>
              </div>
            </div>
          )}

          {hasValidationIssues && (
            <div className="bg-orange-900/30 border border-orange-600/40 rounded-lg p-4 flex items-start gap-3">
              <span className="text-xl flex-shrink-0">⚠️</span>
              <div className="flex-1">
                <p className="text-orange-300 font-semibold text-sm">
                  Data Quality Issues
                </p>
                <ul className="text-orange-200 text-sm mt-2 space-y-1">
                  {predictions.dataValidation?.issues.map((issue, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="text-orange-400">•</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
        <div className="mb-8">
          <p className="text-gray-600 text-sm mb-2 font-medium">PREDICTED OUTCOME</p>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            {predictions.match}
          </h2>

          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div
              className={`px-6 py-3 rounded-full font-bold text-lg flex items-center gap-2 shadow-sm ${
                predictions.predicted_winner === "Home"
                  ? "bg-blue-100 text-blue-700 border border-blue-300"
                  : predictions.predicted_winner === "Away"
                    ? "bg-purple-100 text-purple-700 border border-purple-300"
                    : "bg-yellow-100 text-yellow-700 border border-yellow-300"
              }`}
            >
              <span>
                {predictions.predicted_winner === "Home"
                  ? "🏠"
                  : predictions.predicted_winner === "Away"
                    ? "✈️"
                    : "🤝"}
              </span>
              {predictions.predicted_winner === "Home"
                ? "Home Win"
                : predictions.predicted_winner === "Away"
                  ? "Away Win"
                  : "Draw"}
            </div>
            <div
              className={`px-4 py-3 rounded-full font-bold text-sm flex items-center gap-2 border shadow-sm ${
                predictions.confidence >= 70
                  ? "bg-green-50 text-green-700 border-green-300"
                  : predictions.confidence >= 50
                    ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                    : "bg-orange-50 text-orange-700 border-orange-300"
              }`}
            >
              <span>📊</span>
              {predictions.confidence}% Confidence
              {predictions.confidenceAdjustment && (
                <span className="text-xs ml-1">
                  ({predictions.confidenceAdjustment > 0 ? "+" : ""}
                  {predictions.confidenceAdjustment}%)
                </span>
              )}
            </div>
            
            {/* Save Prediction Button */}
            {selectedMatch && (
              <SavePredictionButton
                matchId={selectedMatch.id}
                prediction={predictions}
                homeTeam={selectedMatch.homeTeam.name}
                awayTeam={selectedMatch.awayTeam.name}
                matchDate={selectedMatch.utcDate}
              />
            )}
          </div>
        </div>

        <p className="text-lg text-gray-700 leading-relaxed mb-8 bg-gradient-to-br from-gray-50 to-blue-50 p-6 rounded-lg border border-gray-200">
          {predictions.summary_insight}
        </p>

        <ConfidenceMetrics predictions={predictions} />
        <DataFreshnessInfo predictions={predictions} />
        
        {/* News Impact Analysis - Full Width */}
        {predictions.newsAnalysis && (
          <NewsImpactCard newsAnalysis={predictions.newsAnalysis} />
        )}
        
        {/* Advanced Analysis Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {predictions.xgAnalysis && (
            <XGAnalysis xg={predictions.xgAnalysis} />
          )}
          {predictions.playerAvailability && (
            <PlayerAvailability players={predictions.playerAvailability} />
          )}
          {predictions.headToHead && (
            <HeadToHeadSummary h2h={predictions.headToHead} />
          )}
        </div>

        {/* Market Comparison Section */}
        {predictions.marketComparison && (
          <MarketComparisonSection comparison={predictions.marketComparison} />
        )}

        {/* Betting Markets Section */}
        {predictions.bettingMarkets && (
          <BettingMarketsSection markets={predictions.bettingMarkets} />
        )}
        
        {predictions.weatherInfo && (
          <WeatherImpact weather={predictions.weatherInfo} />
        )}
        <KeyFactors factors={predictions.key_factors} />
        
        {/* Deep Analysis Sections */}
        {predictions.deepAnalysis && (
          <DeepAnalysisSection analysis={predictions.deepAnalysis} expandedSection={expandedSection} setExpandedSection={setExpandedSection} />
        )}

        <AccuracyExplanation reason={predictions.accuracy_reason} />
      </div>
    </div>
  );
}

function ConfidenceMetrics({ predictions }: { predictions: PredictionResult }) {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70)
      return "from-green-500 to-emerald-400 bg-green-500/20 text-green-300 border-green-500/30";
    if (confidence >= 50)
      return "from-yellow-500 to-amber-400 bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    return "from-orange-500 to-red-400 bg-orange-500/20 text-orange-300 border-orange-500/30";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 70) return "High";
    if (confidence >= 50) return "Medium";
    return "Low";
  };

  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-300">
        <div className="flex items-center justify-between mb-3">
          <p className="text-gray-700 text-sm font-semibold">Confidence</p>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-300`}
          >
            {getConfidenceLabel(predictions.confidence)}
          </span>
        </div>
        <p className="text-4xl font-bold text-blue-700 mb-3">
          {predictions.confidence}%
        </p>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all bg-gradient-to-r ${getConfidenceColor(predictions.confidence).split(" ")[0]} ${getConfidenceColor(predictions.confidence).split(" ")[1]}`}
            style={{ width: `${predictions.confidence}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-3">
          How likely this prediction is correct
        </p>
      </div>

      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-6 border border-emerald-300">
        <div className="flex items-center justify-between mb-3">
          <p className="text-gray-700 text-sm font-semibold">Model Accuracy</p>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-300`}
          >
            {getConfidenceLabel(predictions.predicted_accuracy)}
          </span>
        </div>
        <p className="text-4xl font-bold text-emerald-700 mb-3">
          {predictions.predicted_accuracy}%
        </p>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all bg-gradient-to-r ${getConfidenceColor(predictions.predicted_accuracy).split(" ")[0]} ${getConfidenceColor(predictions.predicted_accuracy).split(" ")[1]}`}
            style={{ width: `${predictions.predicted_accuracy}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-3">
          Estimated accuracy based on data quality
        </p>
      </div>
    </div>
  );
}

function DataFreshnessInfo({
  predictions,
}: {
  predictions: PredictionResult;
}) {
  if (!predictions.dataFreshness && !predictions.dataValidation) return null;

  return (
    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span className="text-lg">📋</span> Data Quality
      </h3>

      <div className="space-y-3">
        {predictions.dataFreshness && (
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Data Freshness</p>
              <p className="text-xs text-gray-600 mt-1">
                {predictions.dataFreshness.message}
              </p>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                predictions.dataFreshness.staleness === "fresh"
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : predictions.dataFreshness.staleness === "recent"
                    ? "bg-blue-500/20 text-blue-700 border border-blue-300"
                    : predictions.dataFreshness.staleness === "stale"
                      ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                      : "bg-red-500/20 text-red-300 border border-red-500/30"
              }`}
            >
              {predictions.dataFreshness.staleness.toUpperCase()}
            </div>
          </div>
        )}

        {predictions.dataValidation && (
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Team Data</p>
              <p className="text-xs text-gray-600 mt-1">
                {predictions.dataValidation.allValid
                  ? "All team statistics complete and valid ✓"
                  : `${predictions.dataValidation.issues.length} data issue${predictions.dataValidation.issues.length > 1 ? "s" : ""}`}
              </p>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                predictions.dataValidation.allValid
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
              }`}
            >
              {predictions.dataValidation.allValid ? "VALID" : "ISSUES"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KeyFactors({ factors }: { factors: string[] }) {
  return (
    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span className="text-lg">📊</span> Key Factors
      </h3>
      <ul className="space-y-3">
        {factors.map((factor, i) => (
          <li key={i} className="flex gap-3 text-gray-700">
            <span className="text-blue-400 font-bold">{i + 1}.</span>
            <span>{factor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeatherImpact({ weather }: { weather: { condition: string; impact: string; affectsPlay: boolean } }) {
  const getWeatherIcon = (condition: string) => {
    const lower = condition.toLowerCase();
    if (lower.includes("rain") || lower.includes("drizzle")) return "🌧️";
    if (lower.includes("cloud") || lower.includes("overcast")) return "☁️";
    if (lower.includes("sun") || lower.includes("clear")) return "☀️";
    if (lower.includes("snow")) return "❄️";
    if (lower.includes("wind")) return "💨";
    if (lower.includes("fog") || lower.includes("mist")) return "🌫️";
    return "🌤️";
  };

  return (
    <div className={`rounded-lg p-4 border mb-6 ${
      weather.affectsPlay 
        ? "bg-amber-900/20 border-amber-600/30" 
        : "bg-gray-50 border-gray-200"
    }`}>
      <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
        <span className="text-lg">{getWeatherIcon(weather.condition)}</span> Weather Conditions
      </h3>
      <div className="flex items-center justify-between">
        <span className="text-gray-700">{weather.condition}</span>
        <span className={weather.affectsPlay ? "text-amber-400 text-sm" : "text-gray-600 text-sm"}>
          {weather.impact}
        </span>
      </div>
    </div>
  );
}

function XGAnalysis({ xg }: { xg: { homeXG: number; awayXG: number; advantage: string; insight: string } }) {
  const xgDiff = xg.homeXG - xg.awayXG;
  const advantageColor = xgDiff > 0.2 ? "text-green-400" : xgDiff < -0.2 ? "text-red-400" : "text-gray-600";
  
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6">
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span className="text-lg">⚽</span> Expected Goals (xG)
      </h3>
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-400">{xg.homeXG}</div>
          <div className="text-xs text-gray-600">Home xG</div>
        </div>
        <div className="text-center">
          <div className={`text-sm font-medium ${advantageColor}`}>{xg.advantage}</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400">{xg.awayXG}</div>
          <div className="text-xs text-gray-600">Away xG</div>
        </div>
      </div>
      <p className="text-gray-600 text-sm text-center">{xg.insight}</p>
    </div>
  );
}
function NewsImpactCard({ newsAnalysis }: { newsAnalysis: NonNullable<PredictionResult['newsAnalysis']> }) {
  const { homeTeamImpact, awayTeamImpact, netAdvantage, adjustmentRecommendation } = newsAnalysis;
  
  const getSentimentColor = (score: number) => {
    if (score > 0.3) return "text-green-400";
    if (score < -0.3) return "text-red-400";
    return "text-gray-400";
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      low: "bg-gray-500/20 text-gray-300 border-gray-500/30",
      medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      high: "bg-orange-500/20 text-orange-300 border-orange-500/30",
      critical: "bg-red-500/20 text-red-300 border-red-500/30",
    };
    return colors[severity as keyof typeof colors] || colors.low;
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-lg p-4 border border-slate-600/30 mb-6">
      <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
        <span className="text-lg">📰</span> News Impact Analysis
      </h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Home Team News */}
        <div className="bg-slate-900/50 rounded p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">{homeTeamImpact.teamName.replace(' FC', '')}</span>
            <span className={`text-xs px-2 py-0.5 rounded border ${getSeverityBadge(homeTeamImpact.severity)}`}>
              {homeTeamImpact.severity}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-slate-400">Sentiment:</span>
            <span className={`font-bold ${getSentimentColor(homeTeamImpact.sentimentScore)}`}>
              {homeTeamImpact.sentimentScore > 0 ? '+' : ''}{(homeTeamImpact.sentimentScore * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-xs text-slate-400 mb-2">{homeTeamImpact.newsCount} articles analyzed</div>
          {homeTeamImpact.keyEvents.length > 0 && (
            <div className="mt-2 space-y-1">
              {homeTeamImpact.keyEvents.slice(0, 2).map((event, i) => (
                <div key={i} className="text-xs text-slate-300 line-clamp-1">
                  {event}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Away Team News */}
        <div className="bg-slate-900/50 rounded p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">{awayTeamImpact.teamName.replace(' FC', '')}</span>
            <span className={`text-xs px-2 py-0.5 rounded border ${getSeverityBadge(awayTeamImpact.severity)}`}>
              {awayTeamImpact.severity}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-slate-400">Sentiment:</span>
            <span className={`font-bold ${getSentimentColor(awayTeamImpact.sentimentScore)}`}>
              {awayTeamImpact.sentimentScore > 0 ? '+' : ''}{(awayTeamImpact.sentimentScore * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-xs text-slate-400 mb-2">{awayTeamImpact.newsCount} articles analyzed</div>
          {awayTeamImpact.keyEvents.length > 0 && (
            <div className="mt-2 space-y-1">
              {awayTeamImpact.keyEvents.slice(0, 2).map((event, i) => (
                <div key={i} className="text-xs text-slate-300 line-clamp-1">
                  {event}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Net Impact */}
      <div className="bg-slate-800/50 rounded p-3 border border-slate-700/30">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Net Advantage:</span>
          <span className={`font-bold ${getSentimentColor(netAdvantage)}`}>
            {netAdvantage > 0 ? 'Home' : netAdvantage < 0 ? 'Away' : 'Balanced'}
          </span>
        </div>
        <p className="text-xs text-slate-300 mt-2">{adjustmentRecommendation}</p>
      </div>
    </div>
  );
}
function PlayerAvailability({ players }: { players: { homeStatus: string; awayStatus: string; insight: string } }) {
  const hasIssues = players.homeStatus !== "Fully fit" || players.awayStatus !== "Fully fit";
  
  return (
    <div className={`rounded-lg p-4 border mb-6 ${
      hasIssues 
        ? "bg-orange-900/20 border-orange-600/30" 
        : "bg-gray-50 border-gray-200"
    }`}>
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span className="text-lg">🏥</span> Squad Fitness
      </h3>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-xs text-gray-600 mb-1">Home Team</div>
          <div className={`text-sm font-medium ${players.homeStatus === "Fully fit" ? "text-green-400" : "text-orange-400"}`}>
            {players.homeStatus}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">Away Team</div>
          <div className={`text-sm font-medium ${players.awayStatus === "Fully fit" ? "text-green-400" : "text-orange-400"}`}>
            {players.awayStatus}
          </div>
        </div>
      </div>
      <p className={`text-sm text-center ${hasIssues ? "text-orange-300" : "text-gray-600"}`}>
        {players.insight}
      </p>
    </div>
  );
}

function HeadToHeadSummary({ h2h }: { h2h: { homeWins: number; draws: number; awayWins: number; totalMatches: number; dominance: string; insight: string } }) {
  const total = h2h.totalMatches;
  
  if (total === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="text-lg">📊</span> Head-to-Head
        </h3>
        <p className="text-gray-600 text-sm text-center">No previous meetings found</p>
      </div>
    );
  }
  
  const homePercent = Math.round((h2h.homeWins / total) * 100);
  const drawPercent = Math.round((h2h.draws / total) * 100);
  const awayPercent = Math.round((h2h.awayWins / total) * 100);
  
  const dominanceColor = h2h.dominance.includes("Home") 
    ? "text-blue-400" 
    : h2h.dominance.includes("Away") 
      ? "text-red-400" 
      : "text-yellow-400";
  
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span className="text-lg">📊</span> Head-to-Head ({total} matches)
      </h3>
      
      {/* H2H Bar */}
      <div className="h-4 rounded-full overflow-hidden flex mb-3">
        <div 
          className="bg-blue-500 transition-all" 
          style={{ width: `${homePercent}%` }}
          title={`Home wins: ${h2h.homeWins}`}
        />
        <div 
          className="bg-gray-300 transition-all" 
          style={{ width: `${drawPercent}%` }}
          title={`Draws: ${h2h.draws}`}
        />
        <div 
          className="bg-red-500 transition-all" 
          style={{ width: `${awayPercent}%` }}
          title={`Away wins: ${h2h.awayWins}`}
        />
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div className="text-center">
          <div className="text-xl font-bold text-blue-400">{h2h.homeWins}</div>
          <div className="text-xs text-gray-600">Home Wins</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-gray-600">{h2h.draws}</div>
          <div className="text-xs text-gray-600">Draws</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-red-400">{h2h.awayWins}</div>
          <div className="text-xs text-gray-600">Away Wins</div>
        </div>
      </div>
      
      <div className={`text-sm font-medium text-center mb-1 ${dominanceColor}`}>
        {h2h.dominance}
      </div>
      <p className="text-gray-600 text-sm text-center">{h2h.insight}</p>
    </div>
  );
}

interface DeepAnalysisSectionProps {
  analysis: PredictionResult["deepAnalysis"];
  expandedSection: string | null;
  setExpandedSection: (section: string | null) => void;
}

function DeepAnalysisSection({
  analysis,
  expandedSection,
  setExpandedSection,
}: DeepAnalysisSectionProps) {
  if (!analysis) return null;

  const sections = [
    { id: "form", title: "📈 Form Analysis", content: analysis.formAnalysis },
    {
      id: "defense",
      title: "🛡️ Defensive Strength",
      content: analysis.defensiveStrength,
    },
    { id: "attack", title: "⚽ Attacking Power", content: analysis.attackingPower },
    { id: "h2h", title: "📊 Head-to-Head", content: analysis.headToHeadInsight },
    {
      id: "dynamics",
      title: "🏟️ Home/Away Dynamics",
      content: analysis.homeAwayDynamics,
    },
    { id: "tactics", title: "🎯 Tactical Analysis", content: analysis.tacticalConsiderations },
  ];

  return (
    <div className="space-y-3 mb-6">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-lg">
        <span>🔍</span> Deep Analysis
      </h3>

      <div className="grid grid-cols-1 gap-3">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() =>
              setExpandedSection(
                expandedSection === section.id ? null : section.id
              )
            }
            className="text-left bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg p-4 border border-gray-200 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">{section.title}</h4>
              <span className="text-gray-600">
                {expandedSection === section.id ? "▼" : "▶"}
              </span>
            </div>

            {expandedSection === section.id && (
              <p className="text-gray-700 text-sm mt-3 leading-relaxed">
                {section.content}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Risk Factors & Possible Outcomes - Always Visible */}
      {(analysis.riskFactors.length > 0 ||
        analysis.matchupMismatches.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {analysis.riskFactors.length > 0 && (
            <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
              <h4 className="font-semibold text-red-300 mb-3 flex items-center gap-2">
                <span>⚠️</span> Risk Factors
              </h4>
              <ul className="space-y-2">
                {analysis.riskFactors.map((risk, i) => (
                  <li key={i} className="text-sm text-red-200 flex gap-2">
                    <span>•</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.matchupMismatches.length > 0 && (
            <div className="bg-purple-900/20 border border-purple-600/30 rounded-lg p-4">
              <h4 className="font-semibold text-purple-300 mb-3 flex items-center gap-2">
                <span>⚡</span> Tactical Mismatches
              </h4>
              <ul className="space-y-2">
                {analysis.matchupMismatches.map((mismatch, i) => (
                  <li key={i} className="text-sm text-purple-200 flex gap-2">
                    <span>•</span>
                    <span>{mismatch}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AccuracyExplanation({ reason }: { reason: string }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <p className="text-sm text-gray-600 mb-2">Why this accuracy level?</p>
      <p className="text-gray-700">{reason}</p>
    </div>
  );
}

interface BettingMarkets {
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  expectedTotalGoals: number;
  overUnder: Array<{
    line: number;
    overProbability: number;
    underProbability: number;
    recommendation: "OVER" | "UNDER" | "SKIP";
    confidence: number;
    insight: string;
  }>;
  btts: {
    yesProbability: number;
    noProbability: number;
    recommendation: "YES" | "NO" | "SKIP";
    confidence: number;
    insight: string;
  };
  asianHandicap: Array<{
    line: number;
    team: "HOME" | "AWAY";
    coverProbability: number;
    recommendation: "BACK" | "SKIP";
    confidence: number;
  }>;
  doubleChance: Array<{
    outcome: "1X" | "X2" | "12";
    probability: number;
    recommendation: "BACK" | "SKIP";
    confidence: number;
  }>;
  topCorrectScores: Array<{
    homeGoals: number;
    awayGoals: number;
    probability: number;
  }>;
  bestBets: string[];
}

interface MarketComparisonData {
  modelProbability: { home: number; draw: number; away: number };
  marketProbability: { home: number; draw: number; away: number };
  ensembleProbability: { home: number; draw: number; away: number };
  modelVsMarket: { homeEdge: number; drawEdge: number; awayEdge: number };
  valueBets: string[];
  marketWeight: number;
  insight: string;
}

function MarketComparisonSection({ comparison }: { comparison: MarketComparisonData }) {
  const getEdgeColor = (edge: number) => {
    if (edge >= 5) return "text-green-400";
    if (edge <= -5) return "text-red-400";
    return "text-gray-700";
  };

  const getEdgeIcon = (edge: number) => {
    if (edge >= 5) return "📈";
    if (edge <= -5) return "📉";
    return "↔️";
  };

  return (
    <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 rounded-xl p-6 border border-indigo-600/30 mb-6">
      <h3 className="text-lg font-bold text-indigo-300 flex items-center gap-2 mb-4">
        <span>⚖️</span> Model vs Market
      </h3>

      {/* Three-way comparison */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Model */}
        <div className="bg-white rounded-lg p-3">
          <p className="text-xs text-gray-600 mb-2 text-center">🤖 Our Model</p>
          <div className="space-y-1 text-center">
            <div className="text-sm">
              <span className="text-blue-700">H:</span>{" "}
              <span className="font-bold text-gray-900">{comparison.modelProbability.home}%</span>
            </div>
            <div className="text-sm">
              <span className="text-yellow-300">D:</span>{" "}
              <span className="font-bold text-gray-900">{comparison.modelProbability.draw}%</span>
            </div>
            <div className="text-sm">
              <span className="text-purple-300">A:</span>{" "}
              <span className="font-bold text-gray-900">{comparison.modelProbability.away}%</span>
            </div>
          </div>
        </div>

        {/* Market */}
        <div className="bg-white rounded-lg p-3">
          <p className="text-xs text-gray-600 mb-2 text-center">📊 Betting Market</p>
          <div className="space-y-1 text-center">
            <div className="text-sm">
              <span className="text-blue-700">H:</span>{" "}
              <span className="font-bold text-gray-900">{comparison.marketProbability.home}%</span>
            </div>
            <div className="text-sm">
              <span className="text-yellow-300">D:</span>{" "}
              <span className="font-bold text-gray-900">{comparison.marketProbability.draw}%</span>
            </div>
            <div className="text-sm">
              <span className="text-purple-300">A:</span>{" "}
              <span className="font-bold text-gray-900">{comparison.marketProbability.away}%</span>
            </div>
          </div>
        </div>

        {/* Ensemble */}
        <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 rounded-lg p-3 border border-indigo-500/30">
          <p className="text-xs text-indigo-300 mb-2 text-center">🎯 Ensemble</p>
          <div className="space-y-1 text-center">
            <div className="text-sm">
              <span className="text-blue-700">H:</span>{" "}
              <span className="font-bold text-indigo-200">{comparison.ensembleProbability.home}%</span>
            </div>
            <div className="text-sm">
              <span className="text-yellow-300">D:</span>{" "}
              <span className="font-bold text-indigo-200">{comparison.ensembleProbability.draw}%</span>
            </div>
            <div className="text-sm">
              <span className="text-purple-300">A:</span>{" "}
              <span className="font-bold text-indigo-200">{comparison.ensembleProbability.away}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edge indicators */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center">
          <span className="text-xs text-gray-600">Home Edge</span>
          <div className={`font-bold ${getEdgeColor(comparison.modelVsMarket.homeEdge)}`}>
            {getEdgeIcon(comparison.modelVsMarket.homeEdge)}{" "}
            {comparison.modelVsMarket.homeEdge > 0 ? "+" : ""}{comparison.modelVsMarket.homeEdge}%
          </div>
        </div>
        <div className="text-center">
          <span className="text-xs text-gray-600">Draw Edge</span>
          <div className={`font-bold ${getEdgeColor(comparison.modelVsMarket.drawEdge)}`}>
            {getEdgeIcon(comparison.modelVsMarket.drawEdge)}{" "}
            {comparison.modelVsMarket.drawEdge > 0 ? "+" : ""}{comparison.modelVsMarket.drawEdge}%
          </div>
        </div>
        <div className="text-center">
          <span className="text-xs text-gray-600">Away Edge</span>
          <div className={`font-bold ${getEdgeColor(comparison.modelVsMarket.awayEdge)}`}>
            {getEdgeIcon(comparison.modelVsMarket.awayEdge)}{" "}
            {comparison.modelVsMarket.awayEdge > 0 ? "+" : ""}{comparison.modelVsMarket.awayEdge}%
          </div>
        </div>
      </div>

      {/* Value Bets */}
      {comparison.valueBets.length > 0 && (
        <div className="bg-green-900/30 border border-green-600/30 rounded-lg p-3 mb-3">
          <p className="text-sm font-semibold text-green-300 mb-2">💰 Value Bets Detected</p>
          <div className="flex flex-wrap gap-2">
            {comparison.valueBets.map((bet, i) => (
              <span key={i} className="bg-green-500/20 text-green-200 text-sm px-3 py-1 rounded-full border border-green-500/30">
                {bet}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Insight */}
      <div className="text-sm text-gray-700 italic flex items-center gap-2">
        <span>💡</span> {comparison.insight}
      </div>
    </div>
  );
}

function BettingMarketsSection({ markets }: { markets: BettingMarkets }) {
  const [expanded, setExpanded] = useState(false);

  const getRecColor = (rec: string) => {
    if (rec === "OVER" || rec === "YES" || rec === "BACK") return "text-green-400";
    if (rec === "UNDER" || rec === "NO") return "text-blue-400";
    return "text-gray-600";
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 65) return "bg-green-500/20 text-green-300 border-green-500/30";
    if (conf >= 55) return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    return "bg-gray-300/20 text-gray-700 border-slate-500/30";
  };

  // Get the O/U 2.5 which is most important
  const ou25 = markets.overUnder.find(o => o.line === 2.5);

  return (
    <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/20 rounded-xl p-6 border border-emerald-600/30 mb-6">
      <div 
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-lg font-bold text-emerald-700 flex items-center gap-2">
          <span>📊</span> Betting Markets Analysis
        </h3>
        <span className="text-gray-600">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Always show key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        {/* Expected Goals */}
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-xs text-gray-600 mb-1">Expected Goals</p>
          <p className="text-xl font-bold text-gray-900">
            {markets.expectedHomeGoals.toFixed(1)} - {markets.expectedAwayGoals.toFixed(1)}
          </p>
          <p className="text-xs text-emerald-700 mt-1">
            Total: {markets.expectedTotalGoals.toFixed(1)}
          </p>
        </div>

        {/* Over 2.5 */}
        {ou25 && (
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600 mb-1">Over/Under 2.5</p>
            <p className={`text-xl font-bold ${getRecColor(ou25.recommendation)}`}>
              {ou25.recommendation}
            </p>
            <p className="text-xs text-gray-700 mt-1">
              O: {ou25.overProbability}% | U: {ou25.underProbability}%
            </p>
          </div>
        )}

        {/* BTTS */}
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-xs text-gray-600 mb-1">Both Teams Score</p>
          <p className={`text-xl font-bold ${getRecColor(markets.btts.recommendation)}`}>
            {markets.btts.recommendation}
          </p>
          <p className="text-xs text-gray-700 mt-1">
            Y: {markets.btts.yesProbability}% | N: {markets.btts.noProbability}%
          </p>
        </div>

        {/* Top Correct Score */}
        {markets.topCorrectScores.length > 0 && (
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600 mb-1">Top Correct Score</p>
            <p className="text-xl font-bold text-amber-300">
              {markets.topCorrectScores[0].homeGoals}-{markets.topCorrectScores[0].awayGoals}
            </p>
            <p className="text-xs text-gray-700 mt-1">
              {markets.topCorrectScores[0].probability}% chance
            </p>
          </div>
        )}
      </div>

      {/* Best Bets Summary */}
      {markets.bestBets.length > 0 && (
        <div className="mt-4 bg-green-900/30 border border-green-600/30 rounded-lg p-3">
          <p className="text-sm font-semibold text-green-300 mb-2">💡 Best Bets</p>
          <div className="flex flex-wrap gap-2">
            {markets.bestBets.map((bet, i) => (
              <span key={i} className="bg-green-500/20 text-green-200 text-sm px-3 py-1 rounded-full border border-green-500/30">
                {bet}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-6 space-y-6">
          {/* Over/Under All Lines */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">⚽ Over/Under Goals</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {markets.overUnder.map((ou) => (
                <div 
                  key={ou.line} 
                  className={`rounded-lg p-3 border ${getConfidenceColor(ou.confidence)}`}
                >
                  <p className="text-xs text-gray-600 mb-1">O/U {ou.line}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold">{ou.recommendation}</span>
                    <span className="text-xs">{ou.confidence}%</span>
                  </div>
                  <div className="text-xs mt-2 text-gray-600">
                    Over: {ou.overProbability}% | Under: {ou.underProbability}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Asian Handicap */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">🎯 Asian Handicap</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {markets.asianHandicap.slice(0, 4).map((ah) => (
                <div 
                  key={`${ah.team}-${ah.line}`} 
                  className={`rounded-lg p-3 border ${getConfidenceColor(ah.confidence)}`}
                >
                  <p className="text-xs text-gray-600 mb-1">
                    {ah.team} {ah.line > 0 ? "+" : ""}{ah.line}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold">{ah.recommendation}</span>
                    <span className="text-xs">{ah.coverProbability}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Double Chance */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">🎲 Double Chance</h4>
            <div className="grid grid-cols-3 gap-3">
              {markets.doubleChance.map((dc) => (
                <div 
                  key={dc.outcome} 
                  className={`rounded-lg p-3 border ${getConfidenceColor(dc.confidence)}`}
                >
                  <p className="text-lg font-bold text-center">{dc.outcome}</p>
                  <p className="text-center text-sm">{dc.probability}%</p>
                  <p className={`text-center text-xs mt-1 ${getRecColor(dc.recommendation)}`}>
                    {dc.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Correct Score Matrix */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">📈 Top Correct Scores</h4>
            <div className="flex flex-wrap gap-2">
              {markets.topCorrectScores.map((cs, i) => (
                <div 
                  key={i} 
                  className={`px-4 py-2 rounded-lg border ${i === 0 ? "bg-amber-500/20 border-amber-500/40" : "bg-gray-100 border-gray-200"}`}
                >
                  <span className="text-lg font-bold text-gray-900">
                    {cs.homeGoals}-{cs.awayGoals}
                  </span>
                  <span className="ml-2 text-sm text-gray-700">{cs.probability}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
