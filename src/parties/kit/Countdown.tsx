import { useEffect, useState } from "react";
import { formatReplyBy, timeLeft, type GuestStatus } from "../model";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The RSVP countdown for any party page, labelled "Time left to reply" so it never reads as the party's own date: "13 days left"
 * with a glowing, pulsing number. In the last 3 days it turns urgent and
 * ticks every second. Once the deadline passes it shows "Expired, not coming". Shows nothing for a guest who already answered.
 */
export default function Countdown({ deadline, status = "invited" }: { deadline: Date; status?: GuestStatus }) {
  const [now, setNow] = useState(() => Date.now());
  const left = timeLeft(deadline, now);
  useEffect(() => {
    if (left.over) return;
    const id = setTimeout(() => setNow(Date.now()), left.urgent ? 1000 - (Date.now() % 1000) : 30_000);
    return () => clearTimeout(id);
  }, [now, left.over, left.urgent]);
  if (status === "accepted" || status === "declined") return null;
  const date = formatReplyBy(deadline), time = deadline.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (status === "expired" || left.over) return <div className="kit-cd is-expired" role="status">
    <p className="kit-cd-kicker">Invitation expired</p>
    <p className="kit-cd-gone">Expired, not coming</p>
    <p className="kit-cd-copy">The reply window closed on {date}, so this spot went to someone else. If you'd still like to come, ask your host to re-invite you.</p>
  </div>;

  if (!left.urgent) return <div className="kit-cd" role="timer" aria-label={`${left.days} days left to reply, until ${date}`}>
    <p className="kit-cd-kicker">Time left to reply</p>
    <p className="kit-cd-big"><span className="kit-cd-num" key={left.days}>{left.days}</span><span className="kit-cd-unit">{left.days === 1 ? "day left" : "days left"}</span></p>
    <div className="kit-cd-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(6, (1 - left.ms / (30 * 86_400_000)) * 100))}%` }} /></div>
    <p className="kit-cd-copy">Please reply by {date}, {time}. Unanswered invitations expire.</p>
  </div>;

  const parts = [...(left.days ? [[left.days, left.days === 1 ? "day" : "days"] as const] : []), [left.hours, "hours"] as const, [left.minutes, "min"] as const, [left.seconds, "sec"] as const];
  return <div className="kit-cd is-urgent" role="timer" aria-label={`Your invitation expires ${date} at ${time}`}>
    <p className="kit-cd-kicker">Time left to reply · last chance</p>
    <div className="kit-cd-tiles" aria-hidden="true">{parts.map(([n, unit], i) => <span key={unit} className={`kit-cd-tile${i === parts.length - 1 ? " is-tick" : ""}`}>
      <b key={i === parts.length - 1 ? n : undefined}>{unit === "days" || unit === "day" ? n : pad(n)}</b><small>{unit}</small>
    </span>)}</div>
    <p className="kit-cd-copy"><strong>Your invitation expires {date}.</strong> Miss it and your spot is gone.</p>
  </div>;
}
