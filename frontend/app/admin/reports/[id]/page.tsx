"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAdminReport, type AdminReport } from "../../lib/adminApi";
import StatusBadge from "../../components/StatusBadge";

export default function ReportDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [report, setReport] = useState<AdminReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminReport(params.id)
      .then(setReport)
      .catch(() => setError("Failed to load report"))
      .finally(() => setIsLoading(false));
  }, [params.id]);

  if (isLoading)
    return <div data-testid="report-detail-loading">Loading...</div>;
  if (error || !report)
    return (
      <div data-testid="report-detail-error">{error ?? "Not found"}</div>
    );

  return (
    <div data-testid="report-detail" className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Report Detail</h1>
        <button
          onClick={() => router.back()}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back
        </button>
      </div>

      {/* Photo */}
      <div>
        <img
          src={report.image_url}
          alt="Report photo"
          className="w-full max-h-96 object-cover rounded-lg border border-gray-200"
        />
      </div>

      {/* Key fields grid */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
        <div>
          <dt className="font-medium text-gray-500">Category</dt>
          <dd className="text-gray-900">{report.category}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Severity</dt>
          <dd className="text-gray-900">{report.severity}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Status</dt>
          <dd>
            <StatusBadge status={report.status} />
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Ward</dt>
          <dd className="text-gray-900">{report.ward_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Submitted</dt>
          <dd className="text-gray-900">
            {new Date(report.created_at).toLocaleDateString()}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Updated</dt>
          <dd className="text-gray-900">
            {new Date(report.updated_at).toLocaleDateString()}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Submitter</dt>
          <dd className="text-gray-900">
            {report.submitter_name ?? "Anonymous"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Contact</dt>
          <dd className="text-gray-900">{report.submitter_contact ?? "—"}</dd>
        </div>
      </dl>

      {/* Description */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 mb-1">Description</h2>
        <p className="text-gray-900 text-sm">
          {report.description ?? "No description"}
        </p>
      </div>

      {/* Duplicate info (if this is a duplicate) */}
      {report.duplicate_of_id && (
        <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm text-orange-700">
          This report is a duplicate of report ID: {report.duplicate_of_id}
        </div>
      )}
      {(report.duplicate_count ?? 0) > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm text-orange-700">
          This report has {report.duplicate_count} linked duplicate(s).
        </div>
      )}
    </div>
  );
}
