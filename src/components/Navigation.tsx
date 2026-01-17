"use client";

interface NavigationProps {
  showLiveIndicator?: boolean;
}

export function Navigation({ showLiveIndicator = true }: NavigationProps) {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-2xl">⚽</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">BTX</h1>
            <p className="text-xs text-gray-500">AI Match Predictions</p>
          </div>
        </div>
        {showLiveIndicator && (
          <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm text-green-700 font-medium">Live Data</span>
          </div>
        )}
      </div>
    </nav>
  );
}
