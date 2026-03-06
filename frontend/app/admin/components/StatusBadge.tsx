"use client";

interface StatusBadgeProps {
  status: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; ariaLabel: string }
> = {
  submitted: {
    label: "Submitted",
    className:
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800",
    ariaLabel: "Status: submitted",
  },
  under_review: {
    label: "Under Review",
    className:
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800",
    ariaLabel: "Status: under review",
  },
  resolved: {
    label: "Resolved",
    className:
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800",
    ariaLabel: "Status: resolved",
  },
};

const FALLBACK_CONFIG = {
  className:
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  if (config) {
    return (
      <span
        role="status"
        className={config.className}
        aria-label={config.ariaLabel}
      >
        {config.label}
      </span>
    );
  }

  // Unknown status fallback — gray, aria-label contains raw value
  return (
    <span
      role="status"
      className={FALLBACK_CONFIG.className}
      aria-label={`Status: ${status}`}
    >
      {status}
    </span>
  );
}
