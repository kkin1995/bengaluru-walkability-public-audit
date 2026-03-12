"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  getAdminReports,
  deleteReport,
  updateReportStatus,
  getMe,
  type AdminReport,
  type AdminReportFilters,
} from "../lib/adminApi";
import ReportsTable from "../components/ReportsTable";

type PageProps = {
  params?: Record<string, string | string[]>;
  searchParams?: Record<string, string | string[] | undefined>;
};

function ReportsPageContent(props: PageProps) {
  const injectedRole = (props as any).role as "admin" | "reviewer" | undefined;
  const searchParams = useSearchParams();

  const [role, setRole] = useState<"admin" | "reviewer">(injectedRole ?? "admin");

  // In production (no injected role from tests), fetch role from the API
  useEffect(() => {
    if (!injectedRole) {
      getMe()
        .then((user: { role?: string }) => {
          setRole(user.role === "reviewer" ? "reviewer" : "admin");
        })
        .catch(() => {
          // keep default "admin" on error
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize filters from URL params at mount time
  const [category, setCategory] = useState<string>(
    searchParams.get("category") ?? ""
  );
  const [status, setStatus] = useState<string>(
    searchParams.get("status") ?? ""
  );
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Status-change modal state
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string>("submitted");
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);

  // Use ref to avoid stale closure in callbacks
  const categoryRef = useRef(category);
  const statusRef = useRef(status);
  categoryRef.current = category;
  statusRef.current = status;

  async function fetchReports(cat: string, sts: string) {
    setIsLoading(true);
    try {
      const filters: AdminReportFilters = {};
      if (cat) filters.category = cat;
      if (sts) filters.status = sts;
      const hasFilters = Object.keys(filters).length > 0;
      const res = await getAdminReports(hasFilters ? filters : undefined);
      setReports(res.data ?? []);
    } catch {
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const initCat = searchParams.get("category") ?? "";
    const initSts = searchParams.get("status") ?? "";
    void fetchReports(initCat, initSts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCategoryChange(value: string) {
    setCategory(value);
    fetchReports(value, statusRef.current);
  }

  function handleStatusChange(value: string) {
    setStatus(value);
    fetchReports(categoryRef.current, value);
  }

  async function handleDelete(id: string) {
    try {
      await deleteReport(id);
      await fetchReports(categoryRef.current, statusRef.current);
    } catch {
      // ignore
    }
  }

  function handleUpdateStatus(id: string) {
    const report = reports.find((r) => r.id === id);
    setPendingStatus(report?.status ?? "submitted");
    setStatusUpdateError(null);
    setChangingStatusId(id);
  }

  async function confirmStatusUpdate() {
    if (!changingStatusId) return;
    setIsStatusUpdating(true);
    setStatusUpdateError(null);
    try {
      await updateReportStatus(changingStatusId, pendingStatus);
      setChangingStatusId(null);
      await fetchReports(categoryRef.current, statusRef.current);
    } catch {
      setStatusUpdateError("Failed to update status. Please try again.");
    } finally {
      setIsStatusUpdating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>

        <ReportsTable
          reports={reports}
          role={role}
          onStatusChange={handleStatusChange}
          onUpdateStatus={handleUpdateStatus}
          onDelete={handleDelete}
          isLoading={isLoading}
          onCategoryChange={handleCategoryChange}
        />

        {changingStatusId !== null && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-status-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          >
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
              <h2
                id="change-status-title"
                className="text-lg font-semibold text-gray-900 mb-4"
              >
                Change Report Status
              </h2>

              <label
                htmlFor="status-select"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                New status
              </label>
              <select
                id="status-select"
                value={pendingStatus}
                onChange={(e) => setPendingStatus(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="resolved">Resolved</option>
              </select>

              {statusUpdateError && (
                <p role="alert" className="text-sm text-red-600 mb-3">
                  {statusUpdateError}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setChangingStatusId(null)}
                  disabled={isStatusUpdating}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStatusUpdate}
                  disabled={isStatusUpdating}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isStatusUpdating ? "Saving..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage(props: PageProps) {
  return (
    <Suspense fallback={<div className="animate-pulse p-6">Loading...</div>}>
      <ReportsPageContent {...props} />
    </Suspense>
  );
}
