"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CHARS = [
  { id: "", label: "Au hasard" },
  { id: "lucie", label: "Lucie Armand" },
  { id: "marc", label: "Marc Delorme" },
  { id: "helene", label: "Hélène Roussel" },
  { id: "paul", label: "Paul Vidal (à 4 seulement)" },
];

type Row = { name: string; phone: string; char: string };

export default function NewGame() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([0, 1, 2, 3].map(() => ({ name: "", phone: "", char: "" })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [past, setPast] = useState<{ id: string; at: number; names: string }[]>([]);

  useEffect(() => {
    try { setPast(JSON.parse(localStorage.getItem("eq-games") || "[]")); } catch {}
  }, []);

  const set = (i: number, k: keyof Row, val: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: val } : x)));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const players = rows.filter((r) => r.name.trim());
      const r = await fetch("/api/enquete/admin/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ players }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      try {
        const list = [{ id: j.id, at: Date.now(), names: players.map((p) => p.name).join(", ") }, ...past].slice(0, 10);
        localStorage.setItem("eq-games", JSON.stringify(list));
      } catch {}
      router.push(`/enquete-admin/${j.id}`);
    } catch (e: any) {
      setErr(e.message || "Création impossible.");
      setBusy(false);
    }
  }

  const count = rows.filter((r) => r.name.trim()).length;
  return (
    <main className="eq-wrap">
      <p className="eq-kicker">Murder party · 3 ou 4 joueurs · 1 h</p>
      <h1 className="eq-h1">La dernière bouteille</h1>
      <p className="eq-lead">Le chef d'un restaurant étoilé de Toulouse est retrouvé mort dans sa cave. Chaque joueur incarne un suspect et reçoit ses secrets par SMS. Des témoins joués par l'IA répondent au téléphone.</p>
      <p className="eq-muted">Si vous jouez aussi, laissez le personnage au hasard et ne lisez pas les SMS des autres dans le tableau de bord.</p>

      <h2 className="eq-h2">Les joueurs</h2>
      <form className="eq-form" onSubmit={create}>
        {rows.map((r, i) => (
          <div className="eq-row" key={i}>
            <input className="eq-input" id={`n${i}`} placeholder={i < 3 ? `Prénom du joueur ${i + 1}` : "4e joueur (facultatif)"} value={r.name} onChange={(e) => set(i, "name", e.target.value)} autoComplete="off" />
            <input className="eq-input" id={`p${i}`} placeholder="06 12 34 56 78" inputMode="tel" value={r.phone} onChange={(e) => set(i, "phone", e.target.value)} autoComplete="off" />
            <select className="eq-select" id={`c${i}`} value={r.char} onChange={(e) => set(i, "char", e.target.value)} aria-label="Personnage">
              {CHARS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        ))}
        <p className="eq-muted">{count === 3 ? "À 3 joueurs, Paul Vidal devient un témoin joué par l'IA." : count === 4 ? "4 joueurs : tous les suspects sont incarnés." : "Il faut 3 ou 4 joueurs."}</p>
        {err && <p className="eq-err">{err}</p>}
        <div><button className="eq-btn" type="submit" disabled={busy || count < 3}>{busy ? "Création…" : "Créer la partie"}</button></div>
      </form>

      {past.length > 0 && (
        <>
          <h2 className="eq-h2">Parties récentes</h2>
          <div className="eq-players">
            {past.map((p) => (
              <a key={p.id} className="eq-player" href={`/enquete-admin/${p.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                <div><b>{p.names}</b><span>{new Date(p.at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</span></div>
                <span>Ouvrir</span>
              </a>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
