"use client";

import React, { useEffect, useState } from "react";
import { MetricCard, StatusBadge, BarChart, DataTable, ProgressBar } from "@/components/DashboardComponents";

interface DashboardData {
  summary: {
    metrics: {
      totalPredictions: number;
      correctPredictions: number;
      accuracy: number;
      averageConfidence: number;
      confidenceCalibration: number;
      recentAccuracy: number;
      predictionsByOutcome: {
        homeWins: number;
        draws: number;
        awayWins: number;
      };
      confidenceBuckets?: {
        "40-50": number;
        "50-60": number;
        "60-70": number;
        "70-80": number;
        "80-90": number;
      };
    };
    calibration: Record<string, number>;
    recent: Array<{
      id: string;
      match: string;
      predicted: "Home" | "Away" | "Draw";
      confidence: number;
      actual?: string;
      correct?: boolean;
    }>;
    health: {
      status: "healthy" | "fair" | "poor";
      accuracy: number;
      recentTrend: "improving" | "declining";
    };
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "accuracy" | "predictions">("overview");

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/analytics");
      const result = await response.json();
      setData(result.summary);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { metrics, calibration, recent, health } = data.summary;

  // Determine colors based on accuracy
  const getAccuracyColor = (accuracy: number): "green" | "orange" | "red" => {
    if (accuracy >= 55) return "green";
    if (accuracy >= 45) return "orange";
    return "red";
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Model Dashboard</h1>
          <p className="text-gray-600">Real-time performance monitoring and analytics</p>
        </div>

        {/* Health Status */}
        <div className="bg-white rounded-lg shadow mb-6 p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Model Health</h2>
              <div className="flex items-center gap-4">
                <StatusBadge status={health.status} label={`${health.status.toUpperCase()}`} />
                <span className="text-sm text-gray-600">
                  Trend: <span className={health.recentTrend === "improving" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                    {health.recentTrend === "improving" ? "↗ Improving" : "↘ Declining"}
                  </span>
                </span>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-sm font-medium"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Main Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Total Predictions"
            value={metrics.totalPredictions}
            icon="📊"
            color="blue"
          />
          <MetricCard
            title="Overall Accuracy"
            value={Math.round(metrics.accuracy)}
            unit="%"
            icon="🎯"
            color={getAccuracyColor(metrics.accuracy)}
            subtext={`${metrics.correctPredictions}/${metrics.totalPredictions} correct`}
          />
          <MetricCard
            title="Recent Accuracy (10)"
            value={metrics.recentAccuracy}
            unit="%"
            icon="📈"
            color={metrics.recentAccuracy > metrics.accuracy ? "green" : "orange"}
          />
          <MetricCard
            title="Avg Confidence"
            value={metrics.averageConfidence}
            unit="%"
            icon="💪"
            color="blue"
            subtext={`Calibration: ${metrics.confidenceCalibration.toFixed(1)}%`}
          />
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-gray-200">
          {(["overview", "accuracy", "predictions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab === "overview" && "📊 Overview"}
              {tab === "accuracy" && "🎯 Accuracy Analysis"}
              {tab === "predictions" && "📝 Recent Predictions"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Prediction Distribution */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Prediction Distribution</h3>
              <ProgressBar
                label="Home Wins"
                value={metrics.predictionsByOutcome.homeWins}
                max={Math.max(
                  metrics.predictionsByOutcome.homeWins,
                  metrics.predictionsByOutcome.draws,
                  metrics.predictionsByOutcome.awayWins
                )}
                color="blue"
              />
              <ProgressBar
                label="Draws"
                value={metrics.predictionsByOutcome.draws}
                max={Math.max(
                  metrics.predictionsByOutcome.homeWins,
                  metrics.predictionsByOutcome.draws,
                  metrics.predictionsByOutcome.awayWins
                )}
                color="orange"
              />
              <ProgressBar
                label="Away Wins"
                value={metrics.predictionsByOutcome.awayWins}
                max={Math.max(
                  metrics.predictionsByOutcome.homeWins,
                  metrics.predictionsByOutcome.draws,
                  metrics.predictionsByOutcome.awayWins
                )}
                color="green"
              />
            </div>

            {/* Confidence Distribution */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Confidence Distribution</h3>
              <BarChart
                data={[
                  { label: "40-50%", value: metrics.confidenceBuckets?.["40-50"] || 0, maxValue: 50, color: "bg-red-500" },
                  { label: "50-60%", value: metrics.confidenceBuckets?.["50-60"] || 0, maxValue: 50, color: "bg-orange-500" },
                  { label: "60-70%", value: metrics.confidenceBuckets?.["60-70"] || 0, maxValue: 50, color: "bg-yellow-500" },
                  { label: "70-80%", value: metrics.confidenceBuckets?.["70-80"] || 0, maxValue: 50, color: "bg-blue-500" },
                  { label: "80-90%", value: metrics.confidenceBuckets?.["80-90"] || 0, maxValue: 50, color: "bg-green-500" },
                ]}
              />
            </div>
          </div>
        )}

        {activeTab === "accuracy" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Accuracy by Confidence Bucket</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {Object.entries(calibration).map(([bucket, accuracy]) => (
                <div key={bucket} className="border border-gray-200 rounded-lg p-4 text-center">
                  <div className="text-sm font-medium text-gray-600 mb-2">{bucket}</div>
                  <div className="text-2xl font-bold text-blue-600 mb-2">{accuracy}%</div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-6">
              💡 <strong>Perfect calibration</strong> means predicted confidence matches actual accuracy.
              {metrics.confidenceCalibration < 5
                ? " Your model is well-calibrated!"
                : " Consider adjusting confidence levels for better calibration."}
            </p>
          </div>
        )}

        {activeTab === "predictions" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Predictions</h3>
            {recent.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No predictions yet</p>
            ) : (
              <DataTable
                headers={["Match", "Prediction", "Confidence", "Actual", "Result"]}
                rows={recent.map((p) => [
                  p.match.substring(0, 30),
                  p.predicted,
                  `${p.confidence}%`,
                  p.actual || "—",
                  p.correct === undefined ? "⏳" : p.correct ? "✓" : "✗",
                ])}
              />
            )}
          </div>
        )}

        {/* Export Section */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Export Data</h3>
          <button
            onClick={async () => {
              const response = await fetch("/api/analytics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "export" }),
              });
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `predictions-${new Date().toISOString().split("T")[0]}.csv`;
              a.click();
            }}
            className="px-4 py-2 bg-green-50 text-green-600 rounded hover:bg-green-100 font-medium text-sm"
          >
            📥 Download CSV
          </button>
        </div>
      </div>
    </main>
  );
}
