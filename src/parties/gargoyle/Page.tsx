import { useEffect, useRef } from "react";
import type { PartyPageProps } from "../types";
import RsvpControls from "../kit/RsvpControls";
import InviteControls from "../kit/InviteControls";
import Scene, { Bat } from "./Scene";
import stryge560 from "./stryge-560.webp";
import stryge1100 from "./stryge-1100.webp";
import "./gargoyle.css";

const DATE = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const NIGHT = "Four stone watchers, one night, and the doors open only for the people on this list. Dress for the dark, follow the green light up the steps, and leave the rest to us.";

/** Fades sections in as they scroll into view (everything is simply shown when motion is reduced). */
function useReveal() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const items = root.current?.querySelectorAll<HTMLElement>(".gg-reveal");
    if (!items?.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) { items.forEach((el) => el.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return root;
}

/** The Gargoyle Party (slug "gargoyle"): Gargoyle House, Pump Hill, Calgary. */
export default function Page(props: PartyPageProps) {
  const { party, guest } = props;
  const root = useReveal();
  const first = guest?.name.trim().split(/\s+/)[0] ?? "";
  const ends = party.endsAt ? ` – ${TIME.format(party.endsAt)}` : "";
  return <div className="gg" ref={root}>
    <header className="gg-hero">
      <div className="gg-sky" aria-hidden="true">
        <div className="gg-stars" /><div className="gg-stars gg-stars-2" />
        <div className="gg-moon" /><div className="gg-cloud gg-cloud-1" /><div className="gg-cloud gg-cloud-2" />
        <div className="gg-beam gg-beam-1" /><div className="gg-beam gg-beam-2" /><div className="gg-beam gg-beam-3" />
        <div className="gg-bat gg-bat-1"><Bat /></div><div className="gg-bat gg-bat-2"><Bat /></div><div className="gg-bat gg-bat-3"><Bat /></div>
      </div>
      <div className="gg-hero-copy">
        <p className="gg-kicker">Uniq Exclusives · A private invitation</p>
        <p className="gg-greet">{first ? <>{first}, you're on the list</> : <>You're on the list</>}</p>
        <h1 className="gg-title">{party.name}</h1>
        <p className="gg-when">{DATE.format(party.startsAt)} <span aria-hidden="true">·</span> {TIME.format(party.startsAt)}{ends}</p>
      </div>
      <div className="gg-scene"><div className="gg-glow" aria-hidden="true" /><Scene /></div>
      <div className="gg-fog" aria-hidden="true"><i /><i /><i /></div>
      <div className="gg-embers" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} />)}</div>
      <a className="gg-cue" href="#gg-details"><span>Enter</span><i aria-hidden="true" /></a>
    </header>

    <main className="gg-main">
      <section id="gg-details" className="gg-tablet gg-reveal" aria-label="Details">
        <dl className="gg-facts">
          <div><dt>When</dt><dd>{DATE.format(party.startsAt)}<br />{TIME.format(party.startsAt)}{ends}</dd></div>
          <div><dt>Dress code</dt><dd>{party.dressCode || <em>To be announced</em>}</dd></div>
          <div><dt>Where</dt><dd>{party.location
            ? <>{party.location}<br /><a className="gg-map" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(party.location)}`} target="_blank" rel="noreferrer">Open in Maps</a></>
            : <em>Revealed closer to the night</em>}</dd></div>
        </dl>
      </section>

      <section className="gg-panel gg-rsvp gg-reveal">
        <p className="gg-label">Your answer</p>
        <h2>{guest?.status === "accepted" ? "You're keeping watch with us" : guest?.status === "declined" ? "We'll miss you on the night" : "Will you keep watch with us?"}</h2>
        {guest?.status === "declined" && guest.canRespond && <p className="gg-prose">Changed your mind? You can still accept until the night.</p>}
        <RsvpControls {...props} />
      </section>

      <section className="gg-panel gg-reveal">
        <p className="gg-label">The night</p>
        <h2>After dark, the stone wakes</h2>
        <p className="gg-prose">{party.description || NIGHT}</p>
      </section>

      <section className="gg-house-story gg-reveal">
        <figure className="gg-etching">
          <img src={stryge1100} srcSet={`${stryge560} 560w, ${stryge1100} 1100w`} sizes="(min-width: 860px) 420px, 92vw" width={1100} height={1199} loading="lazy" decoding="async"
            alt="An engraving of a stone gargoyle resting its chin on its hands above a snowy city" />
        </figure>
        <div className="gg-panel">
          <p className="gg-label">The house</p>
          {party.location ? <>
            <h2>Gargoyle House</h2>
            <p className="gg-sub">Pump Hill · Calgary</p>
            <p className="gg-prose">Calgarians know it by sight. Four restored concrete gargoyles watch from the rooftop and a neoclassical portico anchors the front of this 1990 Pump Hill estate.
              Rebuilt from the studs between 2023 and 2026, its main floor was drawn on the original plans as the Grand Ballroom, and above it all sits a rooftop terrace of nearly 3,000 square feet.</p>
          </> : <>
            <h2>A house with a name</h2>
            <p className="gg-sub">Somewhere in Calgary's southwest</p>
            <p className="gg-prose">Four stone gargoyles keep watch from its roof, and a neoclassical portico guards the door. Built in 1990 and rebuilt from the studs between 2023 and 2026,
              its watchers never left their posts. The address arrives closer to the night.</p>
          </>}
          <ul className="gg-stats">
            <li><strong>4</strong><span>Gargoyles</span></li>
            <li><strong>1990</strong><span>Built</span></li>
            <li><strong>2,991</strong><span>Sq ft rooftop</span></li>
          </ul>
        </div>
      </section>

      {(guest?.invites.allowed || props.preview) && <section className="gg-panel gg-reveal"><InviteControls {...props} /></section>}

      <section className="gg-soon gg-reveal" aria-label="Coming soon">
        <article className="gg-soon-card">
          <span className="gg-badge">Coming soon</span>
          <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 8h24l-10 16v12h7v4H15v-4h7V24L12 8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M17 14h14" stroke="currentColor" strokeWidth="2" /></svg>
          <h3>Drinks &amp; bar tab</h3>
          <p>The menu, and your own tab for the night, will open here before the doors do.</p>
        </article>
        <article className="gg-soon-card">
          <span className="gg-badge">Coming soon</span>
          <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M24 14v10l7 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <h3>Your night</h3>
          <p>{first ? `${first}, everything` : "Everything"} you do on the night, kept here just for you.</p>
        </article>
      </section>
    </main>

    <footer className="gg-foot">
      <img src="/brand/uex-globe.webp" alt="" width={900} height={647} />
      <p className="gg-kicker">UEX · Uniq Exclusives</p>
      <p className="gg-credit">Engraving: Auguste-Louis Lepère, <i>Le Stryge de Notre Dame</i> (1890), Cleveland Museum of Art, CC0, via Wikimedia Commons. House illustration drawn for UEX.</p>
    </footer>
  </div>;
}
