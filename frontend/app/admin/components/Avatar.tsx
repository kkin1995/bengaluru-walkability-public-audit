"use client";

export type AvatarTone = "neutral" | "accent" | "ink";

export interface AvatarProps {
  name: string;
  tone?: AvatarTone;
  size?: number;
}

const TONE_MAP: Record<AvatarTone, { background: string; color: string }> = {
  neutral: { background: "var(--surface-3)", color: "var(--ink-2)" },
  accent:  { background: "var(--accent-bg)", color: "var(--accent-ink)" },
  ink:     { background: "var(--ink)",        color: "var(--bg)" },
};

export function Avatar({ name, tone = "neutral", size = 36 }: AvatarProps): JSX.Element {
  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const t = TONE_MAP[tone];

  return (
    <span
      data-component="avatar"
      data-tone={tone}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "var(--r-full)",
        background: t.background,
        color: t.color,
        fontSize: size * 0.4,
        fontWeight: 600,
        fontFamily: "var(--font-sans)",
        letterSpacing: "0.02em",
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}
