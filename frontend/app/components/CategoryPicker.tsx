"use client";

interface Category {
  value: string;
  label: string;
  emoji: string;
  description: string;
}

const CATEGORIES: Category[] = [
  {
    value: "no_footpath",
    label: "No Footpath",
    emoji: "🚶",
    description: "No path — walking on the road",
  },
  {
    value: "broken_footpath",
    label: "Damaged Footpath",
    emoji: "🕳️",
    description: "Cracked tiles, open drain, dug-up surface",
  },
  {
    value: "blocked_footpath",
    label: "Blocked Footpath",
    emoji: "🚧",
    description: "Bikes, vendors, or debris blocking the path",
  },
  {
    value: "unsafe_crossing",
    label: "Unsafe Crossing",
    emoji: "⚠️",
    description: "No signal, faded zebra, or no crossing at all",
  },
  {
    value: "poor_lighting",
    label: "Poor Lighting",
    emoji: "🌑",
    description: "Street lights out or missing in this area",
  },
  {
    value: "other",
    label: "Other Issue",
    emoji: "📍",
    description: "Doesn't fit above — describe in details",
  },
];

interface CategoryPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export default function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          type="button"
          onClick={() => onChange(cat.value)}
          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-left ${
            value === cat.value
              ? "border-green-600 bg-green-50 shadow-md"
              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
          }`}
        >
          <span className="text-3xl">{cat.emoji}</span>
          <span className="font-semibold text-sm text-gray-800 text-center leading-tight">
            {cat.label}
          </span>
          <span className="text-xs text-gray-500 text-center leading-tight">
            {cat.description}
          </span>
        </button>
      ))}
    </div>
  );
}
