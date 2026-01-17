import React, { useEffect, useState } from "react";

interface UsageStats {
  daily: number;
  remaining: number;
  limit: number;
  percentage: number;
}

interface UsageData {
  usage: UsageStats;
  warnings: string[];
  cacheHitRate: string;
  avgResponseTime: string;
}

export function ApiUsageMonitor() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchUsageStats = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/usage");
      const data = await response.json();
      setUsage(data);
    } catch (error) {
      console.error("Failed to fetch usage stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageStats();
    const interval = setInterval(fetchUsageStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (!usage) {
    return null;
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-orange-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStatusText = (percentage: number) => {
    if (percentage >= 90) return "Critical";
    if (percentage >= 70) return "Warning";
    if (percentage >= 50) return "Moderate";
    return "Good";
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4 border border-gray-200">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-sm font-semibold text-gray-800">API Usage Monitor</h3>
        <button
          onClick={fetchUsageStats}
          disabled={loading}
          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50"
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {/* Usage Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-600">Daily Requests</span>
          <span className="text-sm font-bold text-gray-900">
            {usage.usage.daily}/{usage.usage.limit}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${getProgressColor(
              usage.usage.percentage
            )}`}
            style={{ width: `${Math.min(usage.usage.percentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-600">
            {usage.usage.remaining} remaining ({getStatusText(usage.usage.percentage)})
          </span>
          <span className="text-xs font-semibold text-gray-700">
            {usage.usage.percentage}%
          </span>
        </div>
      </div>

      {/* Warnings */}
      {usage.warnings.length > 0 && (
        <div className="mb-3 space-y-1">
          {usage.warnings.map((warning, idx) => (
            <div
              key={idx}
              className="text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded"
            >
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-50 p-2 rounded">
          <span className="text-gray-600">Cache Hit Rate</span>
          <p className="font-semibold text-gray-900">{usage.cacheHitRate}</p>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <span className="text-gray-600">Avg Response</span>
          <p className="font-semibold text-gray-900">{usage.avgResponseTime}</p>
        </div>
      </div>
    </div>
  );
}
