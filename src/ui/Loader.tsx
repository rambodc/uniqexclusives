import "./ui.css";

/**
 * The UEX loader: the real globe logo (the image itself is never changed), with CSS-only glow, pulse and orbiting light.
 * Sizes: sm (inside buttons), md (inside panels), lg (full page / card overlays). Motion stops with prefers-reduced-motion.
 */
export function GlobeLoader({ label, size = "md" }: { label?: string; size?: "sm" | "md" | "lg" }) {
  return <span className={`uex-loader uex-loader-${size}`} role="status">
    <span className="uex-loader-orb" aria-hidden="true">
      <span className="uex-loader-ring" /><span className="uex-loader-ring uex-loader-ring-2" />
      <img src="/brand/uex-globe.webp" alt="" width={900} height={647} />
    </span>
    {label ? <span className="uex-loader-label">{label}</span> : <span className="uex-sr">Loading</span>}
  </span>;
}

/** A whole page while a route, a party or a signed-in area loads. */
export function PageLoader({ label }: { label?: string }) {
  return <main className="lux-page lux-center uex-page-loader"><div className="lux-aura" aria-hidden="true" /><GlobeLoader size="lg" label={label} /></main>;
}

/** Covers its (position:relative) parent card, e.g. "Opening the door…" after the 6th digit, until the next page loads. */
export function CardOverlay({ label }: { label: string }) {
  return <div className="uex-overlay"><GlobeLoader size="lg" label={label} /></div>;
}

/** Button content while it works: a small globe and the busy text. */
export function Busy({ children }: { children: string }) {
  return <span className="uex-busy"><GlobeLoader size="sm" /><span>{children}</span></span>;
}
