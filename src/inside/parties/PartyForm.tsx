import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { collection, doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { FirebaseError } from "firebase/app";
import { db, deleteParty, saveParty } from "../../core/firebase";
import { storage } from "../../core/storage";
import { fromLocalInput, parseParty, toLocalInput } from "../../parties/model";
import { PAGE_SLUGS } from "../../parties/registry";
import { preparePhoto } from "./photo";

const say = (e: unknown) => e instanceof FirebaseError && e.message && !e.message.startsWith("internal") ? e.message : e instanceof Error ? e.message : "Something went wrong. Please try again.";
type Form = { name: string; description: string; startsAt: string; endsAt: string; location: string; locationRevealed: boolean; dressCode: string; guestLimit: string; published: boolean; pageSlug: string; photoPath: string | null };
const EMPTY: Form = { name: "", description: "", startsAt: "", endsAt: "", location: "", locationRevealed: false, dressCode: "", guestLimit: "", published: false, pageSlug: "", photoPath: null };

/** Owners: create (/app/parties/new) or edit (/app/parties/:id/edit) a party. */
export default function PartyForm() {
  const { partyId } = useParams();
  const editing = !!partyId;
  const [id] = useState(() => partyId ?? doc(collection(db, "parties")).id);
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(editing ? null : EMPTY);
  const [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => f && { ...f, [k]: v });

  useEffect(() => {
    if (!editing) return;
    void (async () => {
      const [p, secret] = await Promise.all([getDoc(doc(db, "parties", id)), getDoc(doc(db, "parties", id, "private", "details"))]);
      const party = parseParty(p.id, p.data());
      if (!party) { setError("That party doesn't exist anymore."); return; }
      setForm({
        name: party.name, description: party.description, startsAt: toLocalInput(party.startsAt), endsAt: toLocalInput(party.endsAt),
        location: (secret.get("location") as string | undefined) ?? "", locationRevealed: party.locationRevealed, dressCode: party.dressCode,
        guestLimit: party.guestLimit ? String(party.guestLimit) : "", published: party.published, pageSlug: party.pageSlug ?? "", photoPath: party.photoPath
      });
      if (party.photoPath) getDownloadURL(ref(storage, party.photoPath)).then(setPreview, () => undefined);
    })();
  }, [editing, id]);
  function pick(next: File | null) {
    setFile(next);
    if (next) setPreview((old) => { if (old?.startsWith("blob:")) URL.revokeObjectURL(old); return URL.createObjectURL(next); });
  }

  async function save(e: FormEvent) {
    e.preventDefault(); if (!form) return; setError("");
    const startsAt = fromLocalInput(form.startsAt), endsAt = form.endsAt ? fromLocalInput(form.endsAt) : null;
    if (!form.name.trim()) { setError("Give the party a name."); return; }
    if (startsAt === null) { setError("Pick the date and time."); return; }
    if (form.endsAt && (endsAt === null || endsAt <= startsAt)) { setError("The end time has to be after the start."); return; }
    const guestLimit = form.guestLimit.trim() ? Number(form.guestLimit) : null;
    if (guestLimit !== null && !(Number.isInteger(guestLimit) && guestLimit > 0)) { setError("The guest limit is a whole number."); return; }
    setBusy("save");
    try {
      let photoPath = form.photoPath;
      if (file) {
        photoPath = `parties/${id}/photo-${Date.now()}.jpg`;
        await uploadBytes(ref(storage, photoPath), await preparePhoto(file), { contentType: "image/jpeg", cacheControl: "private,max-age=86400" });
      }
      await saveParty({
        id, name: form.name.trim(), description: form.description.trim(), photoPath, startsAt, endsAt, location: form.location.trim(),
        locationRevealed: form.locationRevealed, dressCode: form.dressCode.trim(), guestLimit, published: form.published, pageSlug: form.pageSlug || null
      });
      navigate(`/app/parties/${id}`);
    } catch (err) { setError(say(err)); } finally { setBusy(""); }
  }
  async function remove() {
    if (!form || !window.confirm(`Delete ${form.name}? Its guest list, requests and invite links go too. This can't be undone.`)) return;
    setBusy("delete"); setError("");
    try { await deleteParty({ id }); navigate("/app"); } catch (err) { setError(say(err)); setBusy(""); }
  }

  if (!form) return error ? <section className="lux-panel"><p className="lux-error">{error}</p></section> : <div className="spinner" aria-label="Loading" />;
  return <section className="lux-panel">
    <Link to={editing ? `/app/parties/${id}` : "/app"} className="lux-crumb">← {editing ? form.name : "Parties"}</Link>
    <h1>{editing ? "Edit party" : "New party"}</h1>
    <form className="lux-form party-form" onSubmit={save} noValidate>
      <label className="wide">Name<input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} placeholder="UEX 2" /></label>
      <label className="wide">Description<textarea value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={4000} rows={4} placeholder="A night for…" /></label>
      <div className="wide party-photo-field">
        {preview ? <img src={preview} alt="" /> : <span className="party-photo-empty">No photo</span>}
        <label className="lux-ghost as-file">{preview ? "Change photo" : "Add photo"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pick(e.target.files?.[0] ?? null)} /></label>
      </div>
      <label>Starts<input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></label>
      <label>Ends (optional)<input type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></label>
      <label className="wide">Location<textarea value={form.location} onChange={(e) => set("location", e.target.value)} maxLength={400} rows={2} placeholder="Venue and address" /></label>
      <label className="lux-toggle wide"><input type="checkbox" checked={form.locationRevealed} onChange={(e) => set("locationRevealed", e.target.checked)} /><span>Reveal the location to guests</span></label>
      <label>Dress code<input value={form.dressCode} onChange={(e) => set("dressCode", e.target.value)} maxLength={120} placeholder="Black tie" /></label>
      <label>Guest limit<input inputMode="numeric" value={form.guestLimit} onChange={(e) => set("guestLimit", e.target.value.replace(/\D/g, ""))} placeholder="No limit" /></label>
      <label>Custom page<select value={form.pageSlug} onChange={(e) => set("pageSlug", e.target.value)}>
        <option value="">None yet</option>
        {PAGE_SLUGS.map((s) => <option key={s} value={s}>{s}</option>)}
        {form.pageSlug && !PAGE_SLUGS.includes(form.pageSlug) && <option value={form.pageSlug}>{form.pageSlug} (not built)</option>}
      </select></label>
      <label className="lux-toggle"><input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)} /><span>Published</span></label>
      <p className="lux-note wide">Guests see the party only when it's published and its custom page is ready.</p>
      {error && <p className="lux-error wide" role="alert">{error}</p>}
      <div className="wide party-actions">
        <button className="lux-button" disabled={!!busy}>{busy === "save" ? "Saving…" : editing ? "Save" : "Create party"}</button>
        {editing && <button type="button" className="lux-ghost danger" onClick={() => void remove()} disabled={!!busy}>{busy === "delete" ? "Deleting…" : "Delete party"}</button>}
      </div>
    </form>
  </section>;
}
