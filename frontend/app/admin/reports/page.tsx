"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  getAdminReports,
  deleteReport,
  type AdminReport,
  type AdminReportFilters,
} from "../lib/adminApi";
import ReportsTable from "../components/ReportsTable";

interface ReportsPageProps {
  role?: "admin" | "reviewer";
}

export default function ReportsPage({ role = "admin" }: ReportsPageProps) {
  const searchParams = useSearchParams();

  // Initialize filters from URL params at mount time
  const [category, setCategory] = useState<string>(
    searchParams.get("category") ?? ""
  );
  const [status, setStatus] = useState<string>(
    searchParams.get("status") ?? ""
  );
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      setReports(res.data);
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>

        <ReportsTable
          reports={reports}
          role={role}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          isLoading={isLoading}
          onCategoryChange={handleCategoryChange}
        />
      </div>
    </div>
  );
}
