import React from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  color?: "green" | "blue" | "orange" | "red";
  icon?: string;
}

export function MetricCard({
  title,
  value,
  unit,
  subtext,
  color = "blue",
  icon,
}: MetricCardProps) {
  const colorClass = {
    green: "border-green-200 bg-green-50",
    blue: "border-blue-200 bg-blue-50",
    orange: "border-orange-200 bg-orange-50",
    red: "border-red-200 bg-red-50",
  }[color];

  const textColorClass = {
    green: "text-green-700",
    blue: "text-blue-700",
    orange: "text-orange-700",
    red: "text-red-700",
  }[color];

  return (
    <div className={`border ${colorClass} rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600 font-medium">{title}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-bold ${textColorClass}`}>{value}</span>
        {unit && <span className="text-sm text-gray-600">{unit}</span>}
      </div>
      {subtext && <p className="text-xs text-gray-600 mt-2">{subtext}</p>}
    </div>
  );
}

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color?: "green" | "blue" | "orange" | "red";
}

export function ProgressBar({ label, value, max, color = "blue" }: ProgressBarProps) {
  const percentage = (value / max) * 100;
  const colorClass = {
    green: "bg-green-500",
    blue: "bg-blue-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
  }[color];

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-gray-900">
          {value}/{max}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${colorClass}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  status: "healthy" | "fair" | "poor" | "warning";
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const styles = {
    healthy: "bg-green-100 text-green-800 border border-green-300",
    fair: "bg-yellow-100 text-yellow-800 border border-yellow-300",
    poor: "bg-red-100 text-red-800 border border-red-300",
    warning: "bg-orange-100 text-orange-800 border border-orange-300",
  };

  const icons = {
    healthy: "✓",
    fair: "⚠",
    poor: "✗",
    warning: "!",
  };

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
      {icons[status]} {label || status.toUpperCase()}
    </span>
  );
}

interface ChartBarProps {
  label: string;
  value: number;
  maxValue: number;
  color?: string;
}

export function BarChart({ data }: { data: ChartBarProps[] }) {
  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <div className="space-y-3">
      {data.map((item, idx) => (
        <div key={idx}>
          <div className="flex justify-between mb-1">
            <span className="text-xs font-medium text-gray-700">{item.label}</span>
            <span className="text-xs font-semibold text-gray-900">{item.value}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${item.color || "bg-blue-500"}`}
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface DataTableProps {
  headers: string[];
  rows: (string | number)[][];
}

export function DataTable({ headers, rows }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {headers.map((header, idx) => (
              <th key={idx} className="px-3 py-2 text-left font-semibold text-gray-700">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx} className="border-b border-gray-200 hover:bg-gray-50">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-3 py-2 text-gray-900">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
