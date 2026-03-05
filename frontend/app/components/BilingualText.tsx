"use client";

interface BilingualTextProps {
  en: string;
  kn: string;
  enClass?: string;
  knClass?: string;
  containerClass?: string;
}

export function BilingualText({ en, kn, enClass, knClass, containerClass }: BilingualTextProps) {
  return (
    <span className={containerClass ?? "flex flex-col leading-tight"}>
      <span className={enClass ?? "text-base font-semibold"}>{en}</span>
      <span className={knClass ?? "text-sm text-gray-600 font-normal"}>{kn}</span>
    </span>
  );
}
