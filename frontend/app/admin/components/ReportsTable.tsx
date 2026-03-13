"use client";

import React, { useState } from "react";
import StatusBadge from "./StatusBadge";
import { getDuplicatesForReport, type AdminReport } from "../lib/adminApi";

interface Report {
  id: string;
  category: string;
  severity: string;
  status: string;
  created_at: string;
  image_path?: string;
  ward_name?: string | null;
  // ABUSE-06: Deduplication signals
  duplicate_count?: number;
  duplicate_of_id?: string | null;
  duplicate_confidence?: string | null;
}

interface ReportsTableProps {
  reports: Report[];
  role: "admin" | "reviewer";
  onStatusChange: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
  onCategoryChange?: (value: string) => void;
  onStatusFilter?: (value: string) => void;
  onUpdateStatus?: (id: string) => void;
}

// Number of columns in the main table — used for colSpan on expanded rows
const COLUMN_COUNT = 6;

export default function ReportsTable({
  reports,
  role,
  onStatusChange,
  onDelete,
  isLoading,
  onUpdateStatus,
}: ReportsTableProps) {
  // Expandable row state — keyed by report ID
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [duplicateRows, setDuplicateRows] = useState<
    Record<string, AdminReport[]>
  >({});

  async function toggleExpand(reportId: string) {
    const isNowExpanding = !expandedRows[reportId];
    setExpandedRows((prev) => ({ ...prev, [reportId]: isNowExpanding }));

    // Fetch duplicates on first expand only
    if (isNowExpanding && duplicateRows[reportId] === undefined) {
      try {
        const dupes = await getDuplicatesForReport(reportId);
        setDuplicateRows((prev) => ({ ...prev, [reportId]: dupes }));
      } catch {
        setDuplicateRows((prev) => ({ ...prev, [reportId]: [] }));
      }
    }
  }

  if (isLoading) {
    return (
      <div
        data-testid="reports-table-loading"
        className="animate-pulse space-y-3"
      >
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-200 rounded" />
        ))}
      </div>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No reports found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Severity
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ward
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {reports.map((report) => (
            <React.Fragment key={report.id}>
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {report.category}
                  {/* ABUSE-06: Duplicate label for reports that are duplicates */}
                  {report.duplicate_of_id && (
                    <span
                      data-testid="duplicate-label"
                      className="ml-1 text-xs text-gray-500 italic"
                    >
                      Duplicate
                    </span>
                  )}
                  {/* ABUSE-06: Duplicate count badge for original reports */}
                  {(report.duplicate_count ?? 0) > 0 && (
                    <>
                      <span
                        data-testid="duplicate-count-badge"
                        className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"
                        title="Number of duplicate reports at this location"
                      >
                        {report.duplicate_count}x
                      </span>
                      <button
                        data-testid="expand-duplicates-btn"
                        onClick={() => toggleExpand(report.id)}
                        className="ml-1 text-xs text-orange-600 underline hover:text-orange-800"
                        aria-expanded={expandedRows[report.id] ?? false}
                        aria-label={`Show ${report.duplicate_count} duplicate reports`}
                      >
                        {expandedRows[report.id]
                          ? "Hide duplicates"
                          : `+${report.duplicate_count} duplicates`}
                      </button>
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {report.severity}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={report.status} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                  {report.ward_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(report.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm space-x-2">
                  <button
                    onClick={() => (onUpdateStatus ?? onStatusChange)(report.id)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                    aria-label={`Change status for report ${report.id}`}
                  >
                    Change Status
                  </button>
                  {role === "admin" && (
                    <button
                      onClick={() => onDelete(report.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                      aria-label={`Delete report ${report.id}`}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>

              {/* ABUSE-06: Expandable inline sub-table of duplicate reports */}
              {expandedRows[report.id] && (
                <tr key={`${report.id}-duplicates`}>
                  <td colSpan={COLUMN_COUNT} className="p-0">
                    <div className="bg-gray-50 border-l-4 border-orange-200 pl-4 py-2">
                      <p className="text-xs text-gray-500 mb-1 font-medium">
                        Duplicate reports linked to this location:
                      </p>
                      {duplicateRows[report.id] === undefined ? (
                        <p className="text-xs text-gray-400">Loading...</p>
                      ) : duplicateRows[report.id].length === 0 ? (
                        <p className="text-xs text-gray-400">
                          No duplicates loaded yet.
                        </p>
                      ) : (
                        <table className="w-full text-xs">
                          <tbody>
                            {duplicateRows[report.id].map((dupe) => (
                              <tr
                                key={dupe.id}
                                className="border-b border-gray-100"
                              >
                                <td className="py-1 pr-2 text-gray-600">
                                  {dupe.id.slice(0, 8)}
                                </td>
                                <td className="py-1 pr-2 text-gray-600">
                                  {dupe.created_at}
                                </td>
                                <td className="py-1 pr-2 text-gray-600">
                                  {dupe.category}
                                </td>
                                <td className="py-1 pr-2 text-gray-600">
                                  {dupe.severity}
                                </td>
                                <td className="py-1 text-gray-600">
                                  {dupe.status}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
