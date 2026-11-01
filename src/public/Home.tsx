import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { COMPANIES } from "./companies";
import BeamField from "./uex/BeamField";
import { LINES } from "./uex/lines";
import "@fontsource/cinzel/500.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "./uex/uex.css";

const LINE_MS = 3600;

/** Rotating line above the title. Each line fades in, holds, and fades out. */
function Whisper({ start }: { start: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!start) return;
    const id = setInterval(() => setI((n) => (n + 1) % LINES.length), LINE_MS);
    return () => clearInterval(id);
  }, [start]);
  return <p className="uex-whisper" aria-live="polite">{start && <span key={i}>{LINES[i]}</span>}</p>;
}

export default function Home() {
  const { user } = useAuth();
  const globe = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(() => (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 9 : 0));
  useEffect(() => {
    if (stage >= 9) return;
    // 1 globe · 2 UEX · 3 the "2" arrives · 4 Uniq Exclusives · 5 whisper · 6 invite · 7 companies
    const times = [250, 1100, 2500, 3300, 3900, 4500, 5200];
    const ids = times.map((ms, n) => setTimeout(() => setStage(n + 1), ms));
    return () => ids.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the timeline runs once, from the first render
  }, []);
  const at = (n: number) => (stage >= n ? " on" : "");
  return <div className="uex">
    <BeamField anchor={globe} />
    <div className="uex-grain" aria-hidden="true" />
    <main className="uex-stage">
      <Whisper start={stage >= 5} />
      <div className="uex-mark">
        <div ref={globe} className={`uex-globe${at(1)}`}>
          <span className="uex-halo" aria-hidden="true" />
          <img src="/brand/uex-globe.webp" alt="" width={900} height={647} fetchPriority="high" decoding="async" />
        </div>
        <h1 className="uex-title" aria-label="UEX 2">
          <span className={`uex-word${at(2)}`} aria-hidden="true">{"UEX".split("").map((c, n) => <i key={n} style={{ animationDelay: `${n * 140}ms` }}>{c}</i>)}</span>
          <span className={`uex-two${at(3)}`} aria-hidden="true"><i>2</i></span>
        </h1>
      </div>
      <p className={`uex-sub${at(4)}`}>Uniq Exclusives</p>
      <div className={`uex-cta${at(6)}`}>
        <Link className="uex-invite" to={user ? "/account" : "/signin?mode=signup"}>{user ? "Your invitation" : "Request an invite"}</Link>
        {!user && <Link className="uex-signin" to="/signin">Already on the list? <u>Sign in</u></Link>}
      </div>
    </main>
    <footer className={`uex-companies${at(7)}`} aria-label="The Uniq Group">
      {COMPANIES.map((c, n) => {
        const inner = c.logo ? <img src={c.logo.src} alt={c.name} width={c.logo.width} height={c.logo.height} loading="lazy" /> : <span>{c.name}</span>;
        const style = { transitionDelay: `${n * 160}ms` };
        return c.url ? <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer" style={style}>{inner}</a> : <div key={c.id} style={style}>{inner}</div>;
      })}
    </footer>
  </div>;
}
