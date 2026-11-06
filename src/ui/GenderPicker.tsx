import { GENDER_LABELS, type Gender } from "../auth/roles";
import "./ui.css";

/** Required Male / Female choice, as two pill radios. */
export default function GenderPicker({ value, onChange, name }: { value: Gender | ""; onChange: (g: Gender) => void; name: string }) {
  return <fieldset className="uex-gender">
    <legend>Gender</legend>
    <div>{(["male", "female"] as const).map((g) => <label key={g} className={value === g ? "is-on" : ""}>
      <input type="radio" name={name} value={g} checked={value === g} onChange={() => onChange(g)} /><span>{GENDER_LABELS[g]}</span>
    </label>)}</div>
  </fieldset>;
}
