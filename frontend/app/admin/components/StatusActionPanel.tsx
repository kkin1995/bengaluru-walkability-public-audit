"use client";

import type { CSSProperties } from "react";
import { Btn } from "./Btn";
import { Card } from "./Card";
import type { AdminReport } from "../lib/adminApi";

// ─── StatusActionPanel ────────────────────────────────────────────────────────
// Phase 03 (WFLOW-01, D-37, D-38): contextual action button bar.
// Renders per-status button set per UI-SPEC §A and §Copywriting Contract.

export interface StatusActionPanelProps {
  report: AdminReport;
  onStatusChange: (newStatus: string) => Promise<void>;
  onResolveClick: () => void;
  onAssignClick: () => void;
  onCloseClick: () => void;
  disabled?: boolean;
}

export function StatusActionPanel({
  report,
  onStatusChange,
  onResolveClick,
  onAssignClick,
  onCloseClick,
  disabled = false,
}: StatusActionPanelProps): JSX.Element {
  const containerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  };

  let content: JSX.Element;

  switch (report.status) {
    case "open":
      content = (
        <div style={containerStyle}>
          <Btn
            variant="accent"
            size="sm"
            data-testid="action-acknowledge"
            disabled={disabled}
            onClick={() => onStatusChange("acknowledged")}
          >
            Acknowledge
          </Btn>
        </div>
      );
      break;

    case "acknowledged":
      content = (
        <div style={containerStyle}>
          <Btn
            variant="secondary"
            size="sm"
            data-testid="action-assign"
            disabled={disabled}
            onClick={onAssignClick}
          >
            Assign to organisation
          </Btn>
          <Btn
            variant="accent"
            size="sm"
            data-testid="action-mark-in-progress"
            disabled={disabled}
            onClick={() => onStatusChange("in_progress")}
          >
            Mark as in progress
          </Btn>
        </div>
      );
      break;

    case "assigned":
      content = (
        <div style={containerStyle}>
          <Btn
            variant="secondary"
            size="sm"
            data-testid="action-mark-in-progress"
            disabled={disabled}
            onClick={() => onStatusChange("in_progress")}
          >
            Mark as in progress
          </Btn>
          <Btn
            variant="accent"
            size="sm"
            data-testid="action-resolve"
            disabled={disabled}
            onClick={onResolveClick}
          >
            Resolve
          </Btn>
        </div>
      );
      break;

    case "in_progress":
      content = (
        <div style={containerStyle}>
          <Btn
            variant="accent"
            size="sm"
            data-testid="action-resolve"
            disabled={disabled}
            onClick={onResolveClick}
          >
            Resolve
          </Btn>
        </div>
      );
      break;

    case "resolved":
      content = (
        <div style={containerStyle}>
          <Btn
            variant="secondary"
            size="sm"
            data-testid="action-close"
            disabled={disabled}
            onClick={onCloseClick}
          >
            Close report
          </Btn>
        </div>
      );
      break;

    case "closed":
      content = (
        <div
          aria-disabled="true"
          style={{
            color: "var(--muted)",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
          }}
        >
          This report is closed.
        </div>
      );
      break;

    default:
      // Unknown status — show nothing meaningful
      content = <div style={containerStyle} />;
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      {content}
    </Card>
  );
}

export default StatusActionPanel;
