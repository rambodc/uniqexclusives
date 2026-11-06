import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import "./ui.css";

/** An optional field in the popup (e.g. the new RSVP deadline for a re-invite). Its value comes back on confirm. */
type Field = { label: string; type: "datetime-local"; value: string; min?: string; max?: string; hint?: string };
export type Ask = { title: string; body?: ReactNode; confirm: string; danger?: boolean; field?: Field };
type Answer = { value: string } | null;
const Context = createContext<((ask: Ask) => Promise<Answer>) | null>(null);

/**
 * Every important or destructive action asks first: `const confirm = useConfirm(); if (!(await confirm({ … }))) return;`
 * Resolves to { value } (the field's value, or "") when confirmed, null when cancelled (Cancel, Escape or the backdrop).
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<(Ask & { resolve: (a: Answer) => void }) | null>(null), [value, setValue] = useState("");
  const confirmButton = useRef<HTMLButtonElement>(null), cancelButton = useRef<HTMLButtonElement>(null);
  const ask = (a: Ask) => new Promise<Answer>((resolve) => { setValue(a.field?.value ?? ""); setOpen({ ...a, resolve }); });
  const close = (answer: Answer) => { open?.resolve(answer); setOpen(null); };
  useEffect(() => {
    if (!open) return;
    (open.danger ? cancelButton : confirmButton).current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { open.resolve(null); setOpen(null); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  return <Context.Provider value={ask}>
    {children}
    {open && <div className="uex-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) close(null); }}>
      <form className={`uex-modal${open.danger ? " is-danger" : ""}`} role="dialog" aria-modal="true" aria-labelledby="uex-modal-title"
        onSubmit={(e) => { e.preventDefault(); if (!open.field || value) close({ value }); }}>
        <img className="uex-modal-globe" src="/brand/uex-globe.webp" alt="" width={900} height={647} />
        <h2 id="uex-modal-title">{open.title}</h2>
        {open.body && <div className="uex-modal-body">{open.body}</div>}
        {open.field && <label className="uex-modal-field">{open.field.label}
          <input type={open.field.type} value={value} min={open.field.min} max={open.field.max} onChange={(e) => setValue(e.target.value)} required />
          {open.field.hint && <small>{open.field.hint}</small>}
        </label>}
        <div className="uex-modal-actions">
          <button type="button" ref={cancelButton} className="lux-ghost" onClick={() => close(null)}>Cancel</button>
          <button ref={confirmButton} className={open.danger ? "lux-button is-danger" : "lux-button"} disabled={!!open.field && !value}>{open.confirm}</button>
        </div>
      </form>
    </div>}
  </Context.Provider>;
}

export function useConfirm() {
  const ask = useContext(Context);
  if (!ask) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ask;
}
