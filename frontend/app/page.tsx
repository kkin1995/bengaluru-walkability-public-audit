import Link from "next/link";
import { MapPin, Camera, Map } from "lucide-react";
import { BilingualText } from "./components/BilingualText";
import { t } from "./lib/translations";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 p-4 bg-green-100 rounded-full">
          <MapPin className="w-12 h-12 text-green-600" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3 leading-tight">
          Bengaluru Walkability Audit
        </h1>
        <p className="text-lg text-gray-600 mb-2 max-w-sm">
          Spot a broken footpath, blocked crossing, or unsafe road?
        </p>
        <p className="text-base text-gray-500 mb-2 max-w-sm">
          Take a photo and pin the location — your report goes straight to our
          public map.
        </p>

        {/* Mission statement — P1-A */}
        <p className="text-base text-gray-500 mb-8 max-w-sm">
          Your report helps prioritise fixes. You control what is shared.
        </p>

        {/* Primary CTA */}
        <Link
          href="/report"
          className="w-full max-w-xs flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white py-4 px-8 rounded-2xl shadow-lg transition-colors"
        >
          <Camera className="w-6 h-6" />
          <BilingualText
            en="Report an Issue"
            kn="ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ"
            enClass="text-lg font-semibold"
            knClass="text-sm font-normal"
            containerClass="flex flex-col leading-tight"
          />
        </Link>

        {/* Trust pills — P1-A */}
        <p data-testid="trust-pills" className="mt-4 mb-2 text-xs text-gray-400">
          No login · Public map · Open source · Privacy first
        </p>

        {/* Secondary CTA */}
        <Link
          href="/map"
          className="mt-2 w-full max-w-xs flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-green-700 py-3 px-8 rounded-2xl border-2 border-green-200 transition-colors"
        >
          <Map className="w-5 h-5" />
          <BilingualText
            en="View All Reports"
            kn="ಎಲ್ಲ ವರದಿಗಳು ನೋಡಿ"
            enClass="text-base font-medium"
            knClass="text-sm font-normal"
            containerClass="flex flex-col leading-tight"
          />
        </Link>
      </div>

      {/* How it works */}
      <section className="bg-white border-t border-gray-100 px-6 py-10">
        <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-gray-400 mb-6">
          How it works
        </h2>
        <div className="max-w-sm mx-auto space-y-5">
          {[
            { step: "1", title: t.howStep1, desc: "Use your camera or gallery" },
            { step: "2", title: t.howStep2, desc: "GPS auto-detected or drop a pin" },
            { step: "3", title: t.howStep3, desc: "Pick a category and add details" },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                {step}
              </div>
              <div>
                <p className="font-semibold text-gray-800">
                  <BilingualText
                    en={title.en}
                    kn={title.kn}
                    enClass="font-semibold text-gray-800"
                    knClass="text-sm font-normal text-gray-600"
                    containerClass="flex flex-col leading-tight"
                  />
                </p>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center text-xs text-gray-400 py-6">
        Open-source civic tech · Data stored publicly
      </footer>
    </main>
  );
}
