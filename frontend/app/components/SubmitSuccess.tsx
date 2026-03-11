"use client";

import { CheckCircle2, Map, Share2, RefreshCw } from "lucide-react";

interface SubmitSuccessProps {
  onReset: () => void;
}

export default function SubmitSuccess({ onReset }: SubmitSuccessProps) {
  async function handleShare() {
    const shareData = {
      title: "Bengaluru Walkability Audit",
      text: "Help improve pedestrian infrastructure in Bengaluru — report issues near you!",
      url: window.location.origin,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(shareData.url);
      alert("Link copied to clipboard!");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="mb-6 p-4 bg-green-100 rounded-full">
        <CheckCircle2 className="w-16 h-16 text-green-600" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">Report received</h2>
      <p className="text-gray-600 mb-8 max-w-xs">
        Thank you. Your report is visible on the public map.
      </p>

      <div className="w-full max-w-xs space-y-3">
        <a
          href="/map"
          className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-2xl transition-colors"
        >
          <Map className="w-5 h-5" />
          View on Map
        </a>

        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 w-full bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-2xl transition-colors"
        >
          <Share2 className="w-5 h-5" />
          Share this app
        </button>

        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 w-full text-green-700 font-medium py-3 rounded-2xl hover:bg-green-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Submit another report
        </button>
      </div>
    </div>
  );
}
