import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { COMPANIES } from "./companies";

export default function Home() {
  const { user } = useAuth();
  return <div className="site">
    <header className="site-header">
      <Link to="/" className="wordmark">Uniq<span>Exclusives</span></Link>
      <nav><a href="#uex">UEX</a><a href="#companies">Companies</a></nav>
      <Link className="header-login" to={user ? "/account" : "/signin"}>{user ? "My account" : "Sign in"}</Link>
    </header>
    <main>
      <section className="hero">
        <span className="eyebrow">UEX by the Uniq Group</span>
        <h1>Uniq<br /><em>Exclusives.</em></h1>
        <p>Uniq Exclusives is home to the Uniq Group: Uniquem, UniqEnergy Solutions, Kemko and Al Chem. Same owners, one group.</p>
        <div className="hero-actions"><a className="button-primary" href="#companies">Meet the companies</a>{!user && <Link className="button-ghost" to="/signin?mode=signup">Create an account</Link>}</div>
      </section>
      <section id="companies" className="section">
        <div className="section-head"><span className="eyebrow">The Uniq Group</span><h2>Four companies, <em>one group</em></h2></div>
        <div className="company-grid">
          {COMPANIES.map((c) => {
            const inner = <>
              <div className="company-logo">{c.logo ? <><img src={c.logo.src} alt={c.logo.withName ? "" : c.name} width={c.logo.width} height={c.logo.height} className={c.logo.withName ? "mark" : undefined} />{c.logo.withName && <span className="company-name">{c.name}</span>}</> : <span className="company-name">{c.name}</span>}</div>
              <h3>{c.name}</h3>
              {c.blurb && <p>{c.blurb}</p>}
              {c.url && <span className="company-link">Visit site →</span>}
            </>;
            return c.url ? <a key={c.id} className="company-card" href={c.url} target="_blank" rel="noopener noreferrer">{inner}</a> : <article key={c.id} className="company-card">{inner}</article>;
          })}
        </div>
      </section>
      <section id="uex" className="section uex">
        <div><span className="eyebrow">UEX</span><h2>Uniq <em>Exclusives</em></h2>
          <p>UEX is the Uniq Group's invite-only event series: private nights for our partners, clients and friends. Invites, RSVPs and check-in are coming to this site soon.</p></div>
        <Link className="button-primary" to={user ? "/account" : "/signin?mode=signup"}>{user ? "Go to my account" : "Join the list"}</Link>
      </section>
    </main>
    <footer className="site-footer"><span>© {new Date().getFullYear()} Uniq Exclusives · The Uniq Group</span><span>Calgary, Alberta</span></footer>
  </div>;
}
