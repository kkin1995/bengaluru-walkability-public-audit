"use client";

import { Bi } from "@/app/components/ui/Bi";
import { Icon, type IconName } from "@/app/components/ui/Icon";

interface CategoryItem {
  value: string;
  en: string;
  kn: string;
  icon: IconName;
}

// Category list — matches existing enum values and UI-SPEC Screen 2 category mapping table.
// Short labels used per design — do NOT use getCategoryLabel() because those are longer.
const CATEGORIES: CategoryItem[] = [
  { value: "no_footpath",      en: "No path",  kn: "ಕಾಲ್ದಾರಿ ಇಲ್ಲ", icon: "cat_no_path" },
  { value: "broken_footpath",  en: "Damaged",  kn: "ಹಾಳಾದ",           icon: "cat_broken" },
  { value: "blocked_footpath", en: "Blocked",  kn: "ಮುಚ್ಚಿದ",          icon: "cat_blocked" },
  { value: "unsafe_crossing",  en: "Crossing", kn: "ಕ್ರಾಸಿಂಗ್",      icon: "cat_crossing" },
  { value: "poor_lighting",    en: "Lighting", kn: "ಬೆಳಕು",           icon: "cat_lighting" },
  { value: "other",            en: "Other",    kn: "ಇತರ",             icon: "cat_other" },
];

interface CategoryGridProps {
  value: string;
  onChange: (value: string) => void;
}

export function CategoryGrid({ value, onChange }: CategoryGridProps) {
  return (
    <>
      <div
        role="radiogroup"
        aria-label="Issue category"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        {CATEGORIES.map((cat) => {
          const active = value === cat.value;
          return (
            <button
              key={cat.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(cat.value)}
              className="press"
              style={{
                background: active ? "var(--ink)" : "var(--surface)",
                color: active ? "#fafaf9" : "var(--ink)",
                border: active ? "1.5px solid var(--ink)" : "1.5px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "14px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                minHeight: 96,
                position: "relative",
                cursor: "pointer",
              }}
            >
              <Icon name={cat.icon} size={24} />
              <Bi
                en={cat.en}
                kn={cat.kn}
                style={{ fontSize: 13, fontWeight: 600, alignItems: "center", textAlign: "center" }}
              />
              {active && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fafaf9",
                    color: "var(--ink)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Icon name="check" size={12} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Privacy / EXIF notice row — D-10 */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "var(--muted)",
        }}
      >
        <Icon
          name="shield"
          size={14}
          aria-hidden={true}
          style={{ color: "var(--muted)", flexShrink: 0 }}
        />
        <span>Photos are stripped of private metadata before upload</span>
      </div>
    </>
  );
}
