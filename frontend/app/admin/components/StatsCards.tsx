"use client";

interface StatsData {
  total_reports: number;
  by_status: {
    submitted: number;
    under_review: number;
    resolved: number;
  };
}

interface StatsCardsProps {
  data?: StatsData | null;
  loading?: boolean;
  // Props used by dashboard page (stats / isLoading / isError / onRetry shapes)
  stats?: {
    total: number;
    submitted: number;
    under_review: number;
    resolved: number;
  } | null;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function SkeletonCard() {
  return (
    <div
      data-testid="skeleton"
      className="animate-pulse bg-white rounded-2xl shadow-sm p-6"
    >
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-1/3" />
    </div>
  );
}

export default function StatsCards({
  data,
  loading,
  stats,
  isLoading,
  isError,
  onRetry,
}: StatsCardsProps) {
  // Support both prop shapes
  const isLoadingState = loading === true || isLoading === true;

  if (isLoadingState) {
    return (
      <div
        data-testid="stats-cards-loading"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="stats-cards-error" className="text-center py-8">
        <p className="text-red-600 mb-4">Failed to load statistics.</p>
        {onRetry && (
          <button
            data-testid="stats-retry-button"
            onClick={onRetry}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Resolve values from whichever prop shape was used
  let total: number;
  let submitted: number;
  let underReview: number;
  let resolved: number;

  if (stats !== undefined && stats !== null) {
    total = stats.total;
    submitted = stats.submitted;
    underReview = stats.under_review;
    resolved = stats.resolved;
  } else if (data !== undefined && data !== null) {
    total = data.total_reports;
    submitted = data.by_status.submitted;
    underReview = data.by_status.under_review;
    resolved = data.by_status.resolved;
  } else {
    // No data yet — render with zeros
    total = 0;
    submitted = 0;
    underReview = 0;
    resolved = 0;
  }

  return (
    <div
      data-testid="stats-cards"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <p className="text-sm text-gray-600 font-medium">Total Reports</p>
        {" "}
        <p
          data-testid="stat-total"
          className="text-3xl font-bold text-gray-900 mt-1"
        >
          {total}
        </p>
      </div>
      {" "}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <p className="text-sm text-gray-600 font-medium">Submitted</p>
        {" "}
        <p
          data-testid="stat-submitted"
          className="text-3xl font-bold text-gray-900 mt-1"
        >
          {submitted}
        </p>
      </div>
      {" "}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <p className="text-sm text-gray-600 font-medium">Under Review</p>
        {" "}
        <p
          data-testid="stat-under-review"
          className="text-3xl font-bold text-gray-900 mt-1"
        >
          {underReview}
        </p>
      </div>
      {" "}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <p className="text-sm text-gray-600 font-medium">Resolved</p>
        {" "}
        <p
          data-testid="stat-resolved"
          className="text-3xl font-bold text-gray-900 mt-1"
        >
          {resolved}
        </p>
      </div>
    </div>
  );
}
