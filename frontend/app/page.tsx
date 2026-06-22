import type { Metadata } from "next";
import styles from "./coming-soon.module.css";

export const metadata: Metadata = {
  title: "Namma Daari — Coming Soon",
};

export default function ComingSoonPage() {
  return (
    <div className={styles.page}>
      {/* Top bar */}
      <header className={styles.topbar}>
        <div className={styles.wordmark}>
          <span className={styles.en}>Namma Daari</span>
          <span className={`${styles.kn} kn`}>ನಮ್ಮ ದಾರಿ</span>
        </div>
        <div className={styles.statusChip}>
          <span className={`${styles.dot} pulse`} />
          Coming soon · Bengaluru
        </div>
      </header>

      {/* Hero */}
      <main className={styles.hero}>
        <p className={styles.eyebrow}>
          Citizen reporting for <span>walkable streets</span>
        </p>

        <h1 className={styles.tagline}>
          Snap a broken footpath.
          <br />
          <span className={styles.soft}>Put it on Bengaluru&#39;s map.</span>
        </h1>

        <p className={styles.taglineKn}>
          ನಮ್ಮ ದಾರಿ{" "}
          <span className={`${styles.translit} mono`}>namma daari · our path</span>
        </p>

        <p className={styles.desc}>
          Namma Daari turns a quick phone photo into a tracked civic report —
          cracked footpaths, blocked crossings, missing kerb ramps and dark
          stretches along the Namma Metro corridor and beyond.{" "}
          <b>Every report lands in front of BBMP / GBA</b> with a location, a
          ward and a status attached, so nothing quietly disappears. Walkable
          streets start with what we choose to notice.
        </p>

        <div className={styles.ctaRow}>
          <a
            href="https://instagram.com/nammadaariblr"
            target="_blank"
            rel="noopener"
            className={`${styles.igBtn} press`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="2.5"
                y="2.5"
                width="19"
                height="19"
                rx="5.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle
                cx="12"
                cy="12"
                r="4.2"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle cx="17.3" cy="6.7" r="1.3" fill="currentColor" />
            </svg>
            Follow <span className={styles.handle}>@nammadaariblr</span>
          </a>
          <p className={styles.ctaNote}>
            We&#39;re not live yet. Follow along for the launch and the first
            wards we&#39;re mapping.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <span>Built for Bengaluru · ಬೆಂಗಳೂರಿಗಾಗಿ</span>
        <div className={styles.tags}>
          <span className={styles.tag}>Footpaths</span>
          <span className={styles.tag}>Crossings</span>
          <span className={styles.tag}>Lighting</span>
          <span className={styles.tag}>BBMP / GBA</span>
        </div>
      </footer>
    </div>
  );
}
