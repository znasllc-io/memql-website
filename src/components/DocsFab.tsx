import { NeuronLink } from "@/components/Transition";

/**
 * Persistent docs button — fixed to the lower-right corner so the
 * documentation is always one click away, wherever you are on the page.
 * Filled emerald for visibility; a soft breathing glow draws the eye
 * (disabled under prefers-reduced-motion via the global rule in globals.css).
 */
export default function DocsFab() {
  return (
    <NeuronLink
      href="/docs"
      aria-label="Open the documentation"
      className="docs-fab group fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-accent-bright px-5 py-3 font-mono text-[13px] tracking-wide text-bg shadow-lg transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:bottom-6 sm:right-6"
    >
      <svg
        aria-hidden="true"
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        className="opacity-90"
      >
        <path
          d="M2.5 2.8c0-.4.3-.8.8-.8H8v12H3.3c-.5 0-.8.3-.8.8V2.8Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M13.5 2.8c0-.4-.3-.8-.8-.8H8v12h4.7c.5 0 .8.3.8.8V2.8Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      Docs
    </NeuronLink>
  );
}
