"use client";

import StatusBadge from "./StatusBadge";

interface Report {
  id: string;
  category: string;
  severity: string;
  status: string;
  created_at: string;
  image_path?: string;
  ward_name?: string | null;
}

interface ReportsTableProps {
  reports: Report[];
  role: "admin" | "reviewer";
  onStatusChange: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
  onCategoryChange?: (value: string) => void;
  onStatusFilter?: (value: string) => void;
}

export default function ReportsTable({
  reports,
  role,
  onStatusChange,
  onDelete,
  isLoading,
}: ReportsTableProps) {
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
            <tr key={report.id}>
              <td className="px-4 py-3 text-sm text-gray-900">
                {report.category}
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
                  onClick={() => onStatusChange(report.id)}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
