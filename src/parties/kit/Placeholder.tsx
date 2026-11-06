import { formatWhen } from "../model";
import type { PartyPageProps } from "../types";
import Countdown from "./Countdown";
import InviteControls from "./InviteControls";
import RsvpControls from "./RsvpControls";

/** Shown to owners and staff when a party has no custom page yet. Guests never see it. It is also the simplest example of a party page. */
export default function Placeholder(props: PartyPageProps) {
  const { party } = props;
  return <article className="kit-placeholder">
    {party.photoUrl ? <img className="kit-photo" src={party.photoUrl} alt="" /> : <div className="kit-photo kit-photo-empty" aria-hidden="true" />}
    <div className="kit-body">
      <p className="lux-kicker">Uniq Exclusives</p>
      <h1>{party.name}</h1>
      <dl className="kit-facts">
        <div><dt>When</dt><dd>{formatWhen(party.startsAt)}</dd></div>
        {party.dressCode && <div><dt>Dress code</dt><dd>{party.dressCode}</dd></div>}
        <div><dt>Where</dt><dd>{party.location ?? <em>Revealed closer to the night</em>}</dd></div>
      </dl>
      {party.description && <p className="kit-desc">{party.description}</p>}
      <Countdown deadline={props.guest?.rsvpDeadline ?? party.rsvpDeadline} status={props.guest?.status} />
      <RsvpControls {...props} />
      <InviteControls {...props} />
    </div>
  </article>;
}
