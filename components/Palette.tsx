"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export type PaletteItem = { id: string; group: string; label: string; hint?: string; run: () => void };

const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Palette de commandes : ⌘K / Ctrl+K pour tout faire au clavier
export default function Palette({ open, onClose, items }: { open: boolean; onClose: () => void; items: PaletteItem[] }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setI(0);
      setTimeout(() => input.current?.focus(), 10);
    }
  }, [open]);

  const list = useMemo(() => {
    const t = norm(q.trim());
    const words = t.split(/\s+/).filter(Boolean);
    return items.filter((it) => words.every((w) => norm(`${it.label} ${it.group} ${it.hint || ""}`).includes(w))).slice(0, 40);
  }, [q, items]);

  if (!open) return null;

  function key(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(list.length - 1, x + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
    if (e.key === "Enter" && list[i]) { list[i].run(); onClose(); }
    if (e.key === "Escape") onClose();
  }

  let lastGroup = "";
  return (
    <div className="pal-bg" onClick={onClose}>
      <div className="pal" role="dialog" aria-label="Palette de commandes" onClick={(e) => e.stopPropagation()}>
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={key} placeholder="Chercher une entreprise, un métier, une action…" aria-label="Commande" />
        <ul role="listbox">
          {list.map((it, k) => {
            const head = it.group !== lastGroup ? it.group : "";
            lastGroup = it.group;
            return (
              <li key={it.id}>
                {head && <span className="pal-group">{head}</span>}
                <button role="option" aria-selected={k === i} className={k === i ? "on" : ""} onMouseEnter={() => setI(k)} onClick={() => { it.run(); onClose(); }}>
                  <span>{it.label}</span>
                  {it.hint && <small>{it.hint}</small>}
                </button>
              </li>
            );
          })}
          {!list.length && <li className="pal-empty">Rien ne correspond. Essaie un métier ou un nom d'entreprise.</li>}
        </ul>
        <div className="pal-foot"><kbd>↑</kbd><kbd>↓</kbd> naviguer <kbd>↵</kbd> ouvrir <kbd>Échap</kbd> fermer</div>
      </div>
    </div>
  );
}
