"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  getAdminReports,
  deleteReport,
  updateReportStatus,
  getMe,
  downloadCsvExport,
  downloadGeoJsonExport,
  getAdminCorporations,
  getAdminWards,
  type AdminReport,
  type AdminReportFilters,
  type CorporationOption,
  type WardOption,
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

// ─── Searchable Ward Popover ──────────────────────────────────────────────────

interface WardPopoverProps {
  wards: WardOption[];
  wardId: string;
  isLoading: boolean;
  isError: boolean;
  corpName: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

function WardPopover({ wards, wardId, isLoading, isError, corpName, onSelect, onClose }: WardPopoverProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = query
    ? wards.filter(
        (w) =>
          w.ward_name.toLowerCase().includes(query.toLowerCase()) ||
          String(w.ward_number).includes(query)
      )
    : wards;

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        zIndex: 200,
        width: 296,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-sm)",
        boxShadow: "var(--shadow-lg)",
        display: "flex",
        flexDirection: "column",
        maxHeight: 360,
        overflow: "hidden",
      }}
    >
      {/* Search input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="grep ward name or no…"
        style={{
          width: "100%",
          padding: "8px 10px",
          border: "none",
          borderBottom: "1px solid var(--border)",
          outline: "none",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--ink)",
          background: "var(--surface)",
        }}
      />
      {/* Popover header */}
      <div
        style={{
          padding: "4px 10px",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {isLoading
          ? "Loading…"
          : isError
          ? "Unavailable"
          : `Showing ${filtered.length} / 369${corpName ? ` · ${corpName}` : ""}`}
      </div>
      {/* Ward list */}
      <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {/* "All wards" option */}
        <button
          onClick={() => { onSelect(""); onClose(); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "7px 10px",
            border: "none",
            background: wardId === "" ? "var(--accent-bg)" : "transparent",
            color: wardId === "" ? "var(--accent-ink)" : "var(--ink)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          All wards
        </button>
        {isLoading || isError ? null : filtered.length === 0 ? (
          <div
            style={{
              padding: "12px 10px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--muted)",
              textAlign: "center",
            }}
          >
            {`no ward matches '${query}'`}
          </div>
        ) : (
          filtered.map((w) => (
            <button
              key={w.id}
              onClick={() => { onSelect(w.id); onClose(); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "7px 10px",
                border: "none",
                background: wardId === w.id ? "var(--accent-bg)" : "transparent",
                color: "var(--ink)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--muted)",
                  minWidth: 28,
                  flexShrink: 0,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {w.ward_number}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: wardId === w.id ? "var(--accent-ink)" : "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {w.ward_name}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Corporation Popover ──────────────────────────────────────────────────────

interface CorpPopoverProps {
  corps: CorporationOption[];
  corpId: string;
  isLoading: boolean;
  isError: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}

function CorpPopover({ corps, corpId, isLoading, isError, onSelect, onClose }: CorpPopoverProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        zIndex: 200,
        width: 236,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-sm)",
        boxShadow: "var(--shadow-lg)",
        display: "flex",
        flexDirection: "column",
        maxHeight: 320,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "4px 10px",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {isLoading ? "Loading…" : isError ? "Unavailable" : `CORPORATION · ${corps.length}`}
      </div>
      {/* Options list */}
      <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {/* "All corps" option */}
        <button
          onClick={() => { onSelect(""); onClose(); }}
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            padding: "8px 10px",
            border: "none",
            background: corpId === "" ? "var(--accent-bg)" : "transparent",
            color: corpId === "" ? "var(--accent-ink)" : "var(--ink)",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          All corps
        </button>
        {isLoading || isError ? null : corps.map((c) => (
          <button
            key={c.id}
            onClick={() => { onSelect(c.id); onClose(); }}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              padding: "8px 10px",
              border: "none",
              background: corpId === c.id ? "var(--accent-bg)" : "transparent",
              color: corpId === c.id ? "var(--accent-ink)" : "var(--ink)",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Filter trigger button ────────────────────────────────────────────────────

interface FilterTriggerProps {
  label: string;
  value: string;
  placeholder: string;
  isActive: boolean;
  isLoading: boolean;
  isError: boolean;
  isNew?: boolean;
  ariaLabel: string;
  onClick: () => void;
  minWidth?: number;
}

function FilterTrigger({
  label,
  value,
  placeholder,
  isActive,
  isLoading,
  isError,
  isNew,
  ariaLabel,
  onClick,
  minWidth = 120,
}: FilterTriggerProps) {
  const displayValue = isLoading ? "Loading…" : isError ? "Unavailable" : value || placeholder;

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-busy={isLoading}
      disabled={isLoading || isError}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 32,
        padding: "0 10px",
        borderRadius: "var(--r-xs)",
        border: isActive ? "1px solid var(--accent-border)" : "1px solid var(--border)",
        background: isActive ? "var(--accent-bg)" : "var(--surface-2)",
        color: isActive ? "var(--accent-ink)" : "var(--ink)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        cursor: isLoading || isError ? "not-allowed" : "pointer",
        minWidth,
        whiteSpace: "nowrap",
        // NEW indicator ring (removed after interaction)
        outline: isNew ? "1.5px solid var(--accent-border)" : "none",
        outlineOffset: 2,
        opacity: isLoading || isError ? 0.6 : 1,
      }}
    >
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>
        {displayValue}
      </span>
      <span style={{ color: "var(--muted)", fontSize: 10 }}>▾</span>
    </button>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

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

  // Phase 07-04: Geographic filter state (TRIAGE-01, D-01, D-02, D-04)
  const [corporationId, setCorporationId] = useState<string>("");
  const [wardId, setWardId] = useState<string>("");
  const [corporations, setCorporations] = useState<CorporationOption[]>([]);
  const [wards, setWards] = useState<WardOption[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [filterError, setFilterError] = useState<{ corp: boolean; ward: boolean }>({
    corp: false,
    ward: false,
  });

  // Popover open state
  const [corpPopoverOpen, setCorpPopoverOpen] = useState(false);
  const [wardPopoverOpen, setWardPopoverOpen] = useState(false);

  // NEW indicator: remove after first interaction
  const [corpIsNew, setCorpIsNew] = useState(true);
  const [wardIsNew, setWardIsNew] = useState(true);

  // Status-change modal state
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  // CR-04: default to "open" — the Phase-03 enum starts at "open", not "submitted"
  const [pendingStatus, setPendingStatus] = useState<string>("open");
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);

  // Use ref to avoid stale closure in callbacks
  const categoryRef = useRef(category);
  const statusRef = useRef(status);
  const pageRef = useRef(page);
  const corpIdRef = useRef(corporationId);
  const wardIdRef = useRef(wardId);
  categoryRef.current = category;
  statusRef.current = status;
  pageRef.current = page;
  corpIdRef.current = corporationId;
  wardIdRef.current = wardId;

  // Wrapper around the current corp selection for display
  const selectedCorpName = corporations.find((c) => c.id === corporationId)?.name ?? "";
  const selectedWardName = wards.find((w) => w.id === wardId)?.ward_name ?? "";

  async function fetchReports(
    cat: string,
    sts: string,
    pg: number = 1,
    corpId: string = corpIdRef.current,
    wId: string = wardIdRef.current
  ) {
    setIsLoading(true);
    setFetchError(false);
    try {
      const filters: AdminReportFilters = { page: pg, limit: 20 };
      if (cat) filters.category = cat;
      if (sts) filters.status = sts;
      if (corpId) filters.corporation_id = corpId;
      if (wId) filters.ward_id = wId;
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

  // Load corp + ward options on mount (D-03)
  useEffect(() => {
    setIsLoadingFilters(true);
    Promise.all([getAdminCorporations(), getAdminWards()]).then(([corps, ws]) => {
      setCorporations(corps);
      setWards(ws);
      setFilterError({ corp: false, ward: false });
    }).catch(() => {
      // Partial error handling — try each independently
      getAdminCorporations()
        .then((corps) => setCorporations(corps))
        .catch(() => setFilterError((prev) => ({ ...prev, corp: true })));
      getAdminWards()
        .then((ws) => setWards(ws))
        .catch(() => setFilterError((prev) => ({ ...prev, ward: true })));
    }).finally(() => {
      setIsLoadingFilters(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const initCat = searchParams.get("category") ?? "";
    const initSts = searchParams.get("status") ?? "";
    void fetchReports(initCat, initSts, 1, "", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCategoryChange(value: string) {
    setCategory(value);
    fetchReports(value, statusRef.current, 1, corpIdRef.current, wardIdRef.current);
  }

  function handleStatusChange(value: string) {
    setStatus(value);
    fetchReports(categoryRef.current, value, 1, corpIdRef.current, wardIdRef.current);
  }

  // Phase 07-04: Corporation select handler (D-02, D-04)
  const handleCorpSelect = useCallback(async (id: string) => {
    setCorporationId(id);
    setWardId(""); // Reset ward selection on corp change (D-02)
    corpIdRef.current = id;
    wardIdRef.current = "";
    setCorpIsNew(false);

    // Narrow ward list to this corp (D-02)
    try {
      const ws = id ? await getAdminWards(id) : await getAdminWards();
      setWards(ws);
      setFilterError((prev) => ({ ...prev, ward: false }));
    } catch {
      setFilterError((prev) => ({ ...prev, ward: true }));
    }

    // Refetch reports with corporation_id, no ward_id (D-04)
    fetchReports(categoryRef.current, statusRef.current, 1, id, "");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 07-04: Ward select handler (D-04)
  const handleWardSelect = useCallback((id: string) => {
    setWardId(id);
    wardIdRef.current = id;
    setWardIsNew(false);
    fetchReports(categoryRef.current, statusRef.current, 1, corpIdRef.current, id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id: string) {
    try {
      await deleteReport(id);
      await fetchReports(categoryRef.current, statusRef.current, pageRef.current, corpIdRef.current, wardIdRef.current);
    } catch {
      // ignore
    }
  }

  function handleUpdateStatus(id: string) {
    const report = reports.find((r) => r.id === id);
    // CR-04: fall back to "open" (Phase-03 enum first value), not old "submitted"
    setPendingStatus(report?.status ?? "open");
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
      await fetchReports(categoryRef.current, statusRef.current, pageRef.current, corpIdRef.current, wardIdRef.current);
    } catch {
      setStatusUpdateError("Failed to update status. Please try again.");
    } finally {
      setIsStatusUpdating(false);
    }
  }

  // Phase 04-01: Export download handlers (EXPORT-01, EXPORT-02)
  // Build current filter state and trigger a Blob URL download.
  async function handleCsvDownload() {
    try {
      const filters: AdminReportFilters = {};
      if (category) filters.category = category;
      if (status) filters.status = status;
      const blob = await downloadCsvExport(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "walkability-reports.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // CR-02: defer revocation so the browser has time to initiate the download
      // before the Blob URL is invalidated. Synchronous revocation races the
      // browser's download initiation and silently fails on some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch {
      // Silently ignore — export error does not disrupt the page UI
    }
  }

  async function handleGeoJsonDownload() {
    try {
      const filters: AdminReportFilters = {};
      if (category) filters.category = category;
      if (status) filters.status = status;
      const blob = await downloadGeoJsonExport(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "walkability-reports.geojson";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // CR-02: defer revocation so the browser has time to initiate the download.
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch {
      // Silently ignore — export error does not disrupt the page UI
    }
  }

  // Close popovers on outside click
  const corpWrapperRef = useRef<HTMLDivElement>(null);
  const wardWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (corpPopoverOpen && corpWrapperRef.current && !corpWrapperRef.current.contains(e.target as Node)) {
        setCorpPopoverOpen(false);
      }
      if (wardPopoverOpen && wardWrapperRef.current && !wardWrapperRef.current.contains(e.target as Node)) {
        setWardPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [corpPopoverOpen, wardPopoverOpen]);

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

      {/* Phase 07-04: Geographic filter bar (TRIAGE-01, D-01)
          Inline with a vertical separator from the page heading area.
          On tablet the bar scrolls horizontally (no-scrollbar, no wrap). */}
      <div
        className="no-scrollbar"
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          overflowX: "auto",
          marginBottom: 16,
          paddingBottom: 2,
        }}
      >
        {/* Vertical separator */}
        <div
          style={{
            width: 1,
            height: 24,
            background: "var(--border)",
            flexShrink: 0,
          }}
        />

        {/* Corporation trigger + popover */}
        <div
          ref={corpWrapperRef}
          style={{ position: "relative", flexShrink: 0 }}
        >
          <FilterTrigger
            label="CORP:"
            value={selectedCorpName}
            placeholder="All corps"
            isActive={!!corporationId}
            isLoading={isLoadingFilters}
            isError={filterError.corp}
            isNew={corpIsNew}
            ariaLabel="Filter by corporation"
            onClick={() => {
              setCorpIsNew(false);
              setCorpPopoverOpen((prev) => !prev);
              setWardPopoverOpen(false);
            }}
            minWidth={120}
          />
          {corpPopoverOpen && (
            <CorpPopover
              corps={corporations}
              corpId={corporationId}
              isLoading={isLoadingFilters}
              isError={filterError.corp}
              onSelect={handleCorpSelect}
              onClose={() => setCorpPopoverOpen(false)}
            />
          )}
        </div>

        {/* Ward trigger + popover */}
        <div
          ref={wardWrapperRef}
          style={{ position: "relative", flexShrink: 0 }}
        >
          <FilterTrigger
            label="WARD:"
            value={selectedWardName}
            placeholder="All wards"
            isActive={!!wardId}
            isLoading={isLoadingFilters}
            isError={filterError.ward}
            isNew={wardIsNew}
            ariaLabel="Filter by ward"
            onClick={() => {
              setWardIsNew(false);
              setWardPopoverOpen((prev) => !prev);
              setCorpPopoverOpen(false);
            }}
            minWidth={140}
          />
          {wardPopoverOpen && (
            <WardPopover
              wards={wards}
              wardId={wardId}
              isLoading={isLoadingFilters}
              isError={filterError.ward}
              corpName={selectedCorpName}
              onSelect={handleWardSelect}
              onClose={() => setWardPopoverOpen(false)}
            />
          )}
        </div>
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
            onClick={() => fetchReports(categoryRef.current, statusRef.current, pageRef.current, corpIdRef.current, wardIdRef.current)}
          >
            Try again
          </Btn>
        </Card>
      ) : (
        <>
          {/* Phase 04-01: Export buttons — below filter bar, above reports table (D-07) */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <Btn
              variant="ghost"
              size="sm"
              onClick={handleCsvDownload}
              disabled={isLoading}
            >
              Export CSV
            </Btn>
            <Btn
              variant="ghost"
              size="sm"
              onClick={handleGeoJsonDownload}
              disabled={isLoading}
            >
              Export GeoJSON
            </Btn>
          </div>
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
            onPageChange={(pg) => fetchReports(categoryRef.current, statusRef.current, pg, corpIdRef.current, wardIdRef.current)}
          />
        </>
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
              {/* CR-04: Phase-03 status enum — open/acknowledged/assigned/in_progress/resolved/closed */}
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
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
