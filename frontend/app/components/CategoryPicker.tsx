"use client";

import { BilingualText } from "./BilingualText";

interface Category {
  value: string;
  label: string;
  labelKn: string;
  emoji: string;
  description: string;
  descriptionKn: string;
}

const CATEGORIES: Category[] = [
  {
    value: "no_footpath",
    label: "No Footpath",
    labelKn: "ಕಾಲ್ದಾರಿ ಇಲ್ಲ",
    emoji: "🚶",
    description: "No path — walking on the road",
    descriptionKn: "ರಸ್ತೆಯಲ್ಲಿ ನಡೆಯಬೇಕಾಗುತ್ತದೆ",
  },
  {
    value: "broken_footpath",
    label: "Damaged Footpath",
    labelKn: "ಹಾಳಾದ ಕಾಲ್ದಾರಿ",
    emoji: "🕳️",
    description: "Cracked tiles, open drain, dug-up surface",
    descriptionKn: "ಒಡೆದ ಟೈಲ್ಸ್, ತೆರೆದ ಚರಂಡಿ, ಅಗೆದ ಮೇಲ್ಮೈ",
  },
  {
    value: "blocked_footpath",
    label: "Blocked Footpath",
    labelKn: "ಮುಚ್ಚಿದ ಕಾಲ್ದಾರಿ",
    emoji: "🚧",
    description: "Bikes, vendors, or debris blocking the path",
    descriptionKn: "ಬೈಕ್, ವ್ಯಾಪಾರಿ ಅಥವಾ ಅವಶೇಷ ದಾರಿ ತಡೆದಿದೆ",
  },
  {
    value: "unsafe_crossing",
    label: "Unsafe Crossing",
    labelKn: "ಅಸುರಕ್ಷಿತ ದಾಟುವ ಜಾಗ",
    emoji: "⚠️",
    description: "No signal, faded zebra, or no crossing at all",
    descriptionKn: "ಸಿಗ್ನಲ್ ಇಲ್ಲ, ಮಸುಕಾದ ಜೀಬ್ರಾ ಅಥವಾ ಕ್ರಾಸಿಂಗ್ ಇಲ್ಲ",
  },
  {
    value: "poor_lighting",
    label: "Poor Lighting",
    labelKn: "ಕಡಿಮೆ ಬೆಳಕು",
    emoji: "🌑",
    description: "Street lights out or missing in this area",
    descriptionKn: "ಬೀದಿ ದೀಪ ಹೋಗಿದೆ ಅಥವಾ ಇಲ್ಲ",
  },
  {
    value: "other",
    label: "Other Issue",
    labelKn: "ಇತರ ಸಮಸ್ಯೆ",
    emoji: "📍",
    description: "Doesn't fit above — describe in details",
    descriptionKn: "ಮೇಲಿನ ಯಾವುದೂ ಅಲ್ಲ — ವಿವರ ನೀಡಿ",
  },
];

interface CategoryPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export default function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
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
          <BilingualText
            en={cat.label}
            kn={cat.labelKn}
            enClass="font-semibold text-sm text-gray-800 text-center leading-tight"
            knClass="text-sm text-gray-600 text-center"
            containerClass="flex flex-col items-center"
          />
          <BilingualText
            en={cat.description}
            kn={cat.descriptionKn}
            enClass="text-xs text-gray-500 text-center leading-tight"
            knClass="text-sm text-gray-600 text-center"
            containerClass="flex flex-col items-center"
          />
        </button>
      ))}
    </div>
  );
}
