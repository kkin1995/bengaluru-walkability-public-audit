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
import { useOnlineStatus } from "../lib/useOnlineStatus";
import ReportsTable from "../components/ReportsTable";
import { Card } from "../components/Card";
import { Btn } from "../components/Btn";
import { Pill } from "../components/Pill";
import { ThemeToggleButton } from "../components/ThemeToggleButton";

type PageProps = {
  params?: Record<string, string | string[]>;
  searchParams?: Record<string, string | string[] | undefined>;
};

function ReportsPageContent(props: PageProps) {
  const injectedRole = (props as any).role as "admin" | "reviewer" | undefined;
  const searchParams = useSearchParams();
  const isOnline = useOnlineStatus();

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
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Status-change modal state
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string>("submitted");
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);

  // Use ref to avoid stale closure in callbacks
  const categoryRef = useRef(category);
  const statusRef = useRef(status);
  const pageRef = useRef(page);
  categoryRef.current = category;
  statusRef.current = status;
  pageRef.current = page;

  async function fetchReports(cat: string, sts: string, pg: number = 1) {
    setIsLoading(true);
    setFetchError(false);
    try {
      const filters: AdminReportFilters = { page: pg, limit: 20 };
      if (cat) filters.category = cat;
      if (sts) filters.status = sts;
      const res = await getAdminReports(filters);
      setReports(res.data ?? []);
      setTotalCount(res.pagination?.total_count ?? 0);
      setTotalPages(res.pagination?.total_pages ?? 1);
      setPage(res.pagination?.page ?? 1);
    } catch {
      setReports([]);
      setFetchError(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const initCat = searchParams.get("category") ?? "";
    const initSts = searchParams.get("status") ?? "";
    void fetchReports(initCat, initSts, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCategoryChange(value: string) {
    setCategory(value);
    fetchReports(value, statusRef.current, 1);
  }

  function handleStatusChange(value: string) {
    setStatus(value);
    fetchReports(categoryRef.current, value, 1);
  }

  async function handleDelete(id: string) {
    try {
      await deleteReport(id);
      await fetchReports(categoryRef.current, statusRef.current, pageRef.current);
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
      await fetchReports(categoryRef.current, statusRef.current, pageRef.current);
    } catch {
      setStatusUpdateError("Failed to update status. Please try again.");
    } finally {
      setIsStatusUpdating(false);
    }
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, marginLeft: "auto", marginRight: "auto" }}>
      {/* Offline banner — per UI-SPEC Copywriting Contract */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          style={{
            background: "var(--warn-bg)",
            border: "1px solid var(--warn-border)",
            borderRadius: "var(--r-md)",
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <div>
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--warn-ink)", marginBottom: 4 }}>
              {"You're offline right now"}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
              {"Don't worry — everything you've changed has been saved on this device. We'll send it through automatically as soon as you're back online."}
            </div>
          </div>
        </div>
      )}

      {/* Page heading: mono uppercase "QUEUE" + total count chip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: 0,
          }}>
            QUEUE
          </h1>
          <Pill tone="neutral" size="sm" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
            {totalCount}
          </Pill>
        </div>
        <ThemeToggleButton />
      </div>

      {/* API error state — EXACT UI-SPEC string, no raw error */}
      {fetchError ? (
        <Card style={{ padding: 24, textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--muted)",
            marginBottom: 12,
          }}>
            Could not load reports. Check your connection and try again.
          </div>
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => fetchReports(categoryRef.current, statusRef.current, pageRef.current)}
          >
            Try again
          </Btn>
        </Card>
      ) : (
        <ReportsTable
          reports={reports}
          role={role}
          onStatusChange={handleStatusChange}
          onUpdateStatus={handleUpdateStatus}
          onDelete={handleDelete}
          isLoading={isLoading}
          onCategoryChange={handleCategoryChange}
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          onPageChange={(pg) => fetchReports(categoryRef.current, statusRef.current, pg)}
        />
      )}

      {/* Status-change modal */}
      {changingStatusId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-status-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(10,10,10,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--r-xl)",
              boxShadow: "var(--shadow-lg)",
              width: "100%",
              maxWidth: 480,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="change-status-title"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ink)",
                marginBottom: 16,
                margin: "0 0 16px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Change Report Status
            </h2>

            <label
              htmlFor="status-select"
              style={{
                display: "block",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.10em",
                marginBottom: 6,
              }}
            >
              New status
            </label>
            <select
              id="status-select"
              value={pendingStatus}
              onChange={(e) => setPendingStatus(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--r-md)",
                padding: "8px 12px",
                fontSize: 14,
                marginBottom: 16,
                background: "var(--surface)",
                color: "var(--ink)",
                fontFamily: "var(--font-sans)",
              }}
            >
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
            </select>

            {statusUpdateError && (
              <p role="alert" style={{ fontSize: 13, color: "var(--danger-ink)", marginBottom: 12 }}>
                {statusUpdateError}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => setChangingStatusId(null)}
                disabled={isStatusUpdating}
              >
                Cancel
              </Btn>
              <Btn
                variant="accent"
                size="sm"
                onClick={confirmStatusUpdate}
                disabled={isStatusUpdating}
              >
                {isStatusUpdating ? "Saving..." : "Confirm"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage(props: PageProps) {
  return (
    <Suspense fallback={
      <div style={{ padding: "24px 32px" }}>
        <div style={{
          height: 40,
          background: "var(--surface-2)",
          borderRadius: "var(--r-md)",
          width: 120,
          marginBottom: 16,
        }} />
      </div>
    }>
      <ReportsPageContent {...props} />
    </Suspense>
  );
}
