"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { Btn } from "./Btn";
import { Card } from "./Card";
import { SectionLabel } from "./SectionLabel";
import { resolveReport, type AdminReport } from "../lib/adminApi";

// ─── ResolveModal ─────────────────────────────────────────────────────────────
// Phase 03 (WFLOW-04, WFLOW-05, D-13, D-14, D-15, D-16): Combined resolve/close
// modal with mandatory after-photo and optional resolution notes.

export interface ResolveModalProps {
  open: boolean;
  mode: "resolve" | "close";
  report: AdminReport;
  onClose: () => void;
  onResolved: (updated: AdminReport) => void;
}

export function ResolveModal({
  open,
  mode,
  report,
  onClose,
  onResolved,
}: ResolveModalProps): JSX.Element | null {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URL on unmount or when photo changes
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoPreviewUrl]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setPhotoFile(null);
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
        setPhotoPreviewUrl(null);
      }
      setNotes("");
      setError(null);
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const title = mode === "resolve" ? "Resolve report" : "Close report";
  const submitLabel = mode === "resolve" ? "Mark as resolved" : "Mark as closed";
  const targetStatus: "resolved" | "closed" = mode === "resolve" ? "resolved" : "closed";

  // Audit echo — first 8 hex chars of report ID
  const reportShortId = `WLK-${report.id.slice(0, 8).toUpperCase()}`;
  const transitionLabel = mode === "resolve" ? "Resolved" : "Closed";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    // Accept only image files
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPEG, PNG, etc.).");
      return;
    }
    setError(null);
    // Revoke previous preview
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemovePhoto() {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit() {
    if (!photoFile || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await resolveReport(report.id, targetStatus, photoFile, notes || undefined);
      onResolved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const dropzoneStyle: CSSProperties = {
    border: `1px dashed ${photoFile ? "var(--border-strong)" : "var(--danger-border)"}`,
    borderRadius: "var(--r-md)",
    padding: 20,
    textAlign: "center" as const,
    cursor: "pointer",
    position: "relative" as const,
    marginBottom: 12,
    background: photoFile ? "var(--surface-2)" : "var(--danger-bg)",
    minHeight: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column" as const,
    gap: 8,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resolve-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(10,10,10,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={() => !submitting && onClose()}
    >
      <Card
        style={{ width: "100%", maxWidth: 520, padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h2
          id="resolve-modal-title"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 600,
            color: "var(--ink)",
            margin: "0 0 16px",
          }}
        >
          {title}
        </h2>

        {/* Close-mode amber warning (UI-SPEC §D close variant warning) */}
        {mode === "close" && (
          <div
            data-testid="close-warning"
            style={{
              background: "var(--warn-bg)",
              border: "1px solid var(--warn-border)",
              borderRadius: "var(--r-sm)",
              padding: "10px 12px",
              fontSize: 13,
              color: "var(--warn-ink)",
              marginBottom: 16,
            }}
          >
            Closing is permanent. The report will be archived and removed from the active queue.
          </div>
        )}

        {/* Photo upload section */}
        <SectionLabel style={{ marginBottom: 8 }}>
          After photo
          {!photoFile && (
            <span
              data-testid="resolve-required-alert"
              style={{
                marginLeft: 8,
                background: "var(--danger-bg)",
                color: "var(--danger-ink)",
                border: "1px solid var(--danger-border)",
                borderRadius: "var(--r-xs)",
                padding: "2px 6px",
                fontSize: 9,
                letterSpacing: "0.06em",
                fontWeight: 600,
              }}
            >
              REQUIRED
            </span>
          )}
        </SectionLabel>

        {/* Photo required alert banner */}
        {!photoFile && (
          <div
            style={{
              background: "var(--danger-bg)",
              border: "1px solid var(--danger-border)",
              borderRadius: "var(--r-sm)",
              padding: "8px 12px",
              fontSize: 12,
              color: "var(--danger-ink)",
              marginBottom: 8,
            }}
          >
            A photo is required to mark this report as resolved.
          </div>
        )}

        {/* Dropzone / preview */}
        <div style={dropzoneStyle}>
          {photoPreviewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-testid="resolve-photo-preview"
                src={photoPreviewUrl}
                alt="Resolution photo preview"
                style={{
                  maxHeight: 120,
                  maxWidth: "100%",
                  objectFit: "contain",
                  borderRadius: "var(--r-sm)",
                }}
              />
              <Btn
                variant="danger-soft"
                size="xs"
                data-testid="resolve-photo-remove"
                onClick={handleRemovePhoto}
                style={{ marginTop: 4 }}
              >
                Remove
              </Btn>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Click to add after photo
              </div>
              <div style={{ fontSize: 11, color: "var(--muted-2)" }}>JPEG or PNG</div>
            </>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          data-testid="resolve-photo-input"
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/*"
          onChange={handleFileChange}
          style={{
            position: "absolute",
            opacity: 0,
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
          aria-label="Upload after photo"
          id="resolve-photo-file-input"
        />
        {/* Clickable label that opens file input */}
        <label
          htmlFor="resolve-photo-file-input"
          style={{
            display: "block",
            cursor: "pointer",
            marginBottom: 16,
            fontSize: 12,
            color: "var(--accent-ink)",
            textDecoration: "underline",
          }}
        >
          {photoFile ? "Change photo" : "Select photo from device"}
        </label>

        {/* Resolution notes */}
        <SectionLabel style={{ marginBottom: 6 }}>Resolution notes (optional)</SectionLabel>
        <textarea
          data-testid="resolve-notes-input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional — describe what was done"
          aria-label="Resolution notes"
          rows={3}
          style={{
            width: "100%",
            resize: "vertical",
            maxHeight: 120,
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-xs)",
            padding: "10px 12px",
            background: "var(--surface)",
            color: "var(--ink)",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 16,
          }}
        />

        {/* Audit echo */}
        <div
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--muted)",
            marginBottom: 16,
          }}
        >
          {reportShortId} · {report.status.replace("_", " ")} → {transitionLabel}
        </div>

        {/* Error */}
        {error && (
          <div role="alert" style={{ fontSize: 13, color: "var(--danger-ink)", marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn
            variant="ghost"
            size="sm"
            data-testid="resolve-cancel"
            onClick={onClose}
            disabled={submitting}
          >
            Discard
          </Btn>
          <Btn
            variant="accent"
            size="sm"
            data-testid="resolve-submit"
            disabled={photoFile === null || submitting}
            onClick={handleSubmit}
            style={photoFile === null ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          >
            {submitting ? "Submitting…" : submitLabel}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

export default ResolveModal;
