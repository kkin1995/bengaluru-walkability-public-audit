"use client";

import { useState, useEffect, useCallback } from "react";
import { getStats, type AdminStats } from "./lib/adminApi";
import StatsCards from "./components/StatsCards";

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const data = await getStats();
      setStats(data);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  // Derive the stats shape expected by StatsCards
  const statsForCards = stats
    ? {
        total: stats.total_reports,
        submitted: stats.by_status.submitted,
        under_review: stats.by_status.under_review,
        resolved: stats.by_status.resolved,
      }
    : null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

        <StatsCards
          stats={statsForCards}
          isLoading={isLoading}
          isError={isError}
          onRetry={fetchStats}
        />
      </div>
    </div>
  );
}
