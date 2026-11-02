"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { play, stopAudio, unlockAudio } from "../../../../components/enquete/audio";

type View = {
  title: string; venue: string; facts: string; voiceLive: boolean;
  me: { name: string; char: { id: string; name: string; age: number; role: string; costume: string; publicIntro: string }; official: string | null; secret: string | null; objectives: string[] | null; clues: string[] };
  cast: { name: string; char: string; role: string; publicIntro: string; me: boolean }[];
  acts: { id: string; title: string; at: number | null }[];
  npcs: { id: string; name: string; role: string; initials: string }[];
  lab: string[] | null;
  vote: { suspects: { id: string; name: string }[]; motives: { id: string; label: string }[]; mine: { culprit: string; motive: string } | null } | null;
  solution: { text: string; results: { killerWins: boolean; killer: { name: string; char: string } | null; detail: { name: string; char: string; culprit: string | null; motive: string | null; right: boolean; motiveRight: boolean }[] } } | null;
};
type Line = { role: "user" | "assistant"; content: string; audio?: string };

const PHONE = <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg>;

function Call({ npc, base, onClose }: { npc: View["npcs"][number]; base: string; onClose: () => void }) {
  const store = `eq-call-${base}-${npc.id}`;
  const [lines, setLines] = useState<Line[]>(() => {
    try { return JSON.parse(localStorage.getItem(store) || "[]"); } catch { return []; }
  });
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [t0] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const logRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: 1e6 }); }, [lines, busy]);
  useEffect(() => {
    try { localStorage.setItem(store, JSON.stringify(lines.map(({ role, content }) => ({ role, content })))); } catch {}
  }, [lines, store]);

  const ask = useCallback(async (history: Line[]) => {
    setBusy(true); setNote("");
    try {
      const r = await fetch(`/api/enquete/play/${base}/talk`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npc: npc.id, history: history.map(({ role, content }) => ({ role, content })) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "La ligne a coupé.");
      const audio = j.audio ? `data:audio/mpeg;base64,${j.audio}` : undefined;
      setLines([...history, { role: "assistant", content: j.say, audio }]);
      if (audio) {
        const ok = await play(audio, { start: () => setSpeaking(true), end: () => setSpeaking(false) });
        if (!ok) setNote("Touchez « Écouter » sous la réponse pour l'entendre.");
      } else if (j.audioError) setNote("Voix indisponible : " + j.audioError);
    } catch (e: any) {
      setLines(history);
      setNote(e.message);
    } finally {
      setBusy(false);
    }
  }, [base, npc.id]);

  // Le témoin décroche
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const opener: Line = { role: "user", content: lines.length ? "[On te rappelle. Tu décroches.]" : "[Tu décroches.]" };
    ask([...lines, opener]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function send(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!v || busy) return;
    unlockAudio(); stopAudio();
    setQ("");
    const h = [...lines, { role: "user" as const, content: v }];
    setLines(h);
    ask(h);
  }

  const sec = Math.floor((now - t0) / 1000);
  return (
    <div className={`eq-call${speaking ? " eq-speaking" : ""}`} role="dialog" aria-modal="true" aria-label={`Appel avec ${npc.name}`}>
      <div className="eq-call-head">
        <div className="eq-avatar" aria-hidden="true">{npc.initials}</div>
        <h3>{npc.name}</h3>
        <div className="eq-call-state">{busy ? "…" : `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`}</div>
      </div>
      <div className="eq-log" ref={logRef} aria-live="polite">
        {lines.filter((l) => !(l.role === "user" && l.content.startsWith("["))).map((l, i) => (
          <div key={i} className={`eq-msg ${l.role === "assistant" ? "them" : "me"}`}>
            {l.content}
            {l.role === "assistant" && l.audio && (
              <button type="button" className="eq-replay" onClick={() => { unlockAudio(); play(l.audio!, { start: () => setSpeaking(true), end: () => setSpeaking(false) }); }}>Écouter</button>
            )}
          </div>
        ))}
        {busy && <div className="eq-msg sys">{lines.some((l) => l.role === "assistant") ? `${npc.name.split(" ")[0]} réfléchit…` : "Ça sonne…"}</div>}
        {note && <div className="eq-msg sys">{note}</div>}
      </div>
      <div className="eq-call-foot">
        <form className="eq-ask" onSubmit={send}>
          <textarea id="eq-q" rows={1} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Votre question… (micro du clavier pour parler)"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
          <button className="eq-send" type="submit" disabled={busy || !q.trim()} aria-label="Envoyer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </form>
        <button className="eq-hang" type="button" onClick={() => { stopAudio(); onClose(); }} aria-label="Raccrocher">{PHONE}</button>
      </div>
    </div>
  );
}

export default function PlayerPage() {
  const { id, token } = useParams<{ id: string; token: string }>();
  const base = `${id}/${token}`;
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const [calling, setCalling] = useState<View["npcs"][number] | null>(null);
  const [culprit, setCulprit] = useState("");
  const [motive, setMotive] = useState("");
  const [voteMsg, setVoteMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/enquete/play/${base}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setV(j); setErr("");
      if (j.vote?.mine) { setCulprit((c) => c || j.vote.mine.culprit); setMotive((m) => m || j.vote.mine.motive); }
    } catch (e: any) { setErr(e.message || "Connexion perdue."); }
  }, [base]);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  async function vote(e: React.FormEvent) {
    e.preventDefault();
    setVoteMsg("");
    const r = await fetch(`/api/enquete/play/${base}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ culprit, motive }) });
    const j = await r.json().catch(() => ({}));
    setVoteMsg(r.ok ? "Vote enregistré. Vous pouvez le changer jusqu'à la révélation." : j.error || "Vote impossible.");
    if (r.ok) load();
  }

  if (!v) return <main className="eq-wrap"><p className="eq-muted">{err || "Ouverture du dossier…"}</p></main>;
  const done = v.acts.filter((a) => a.at);
  const current = done[done.length - 1];
  const first = v.me.char.name.split(" ")[0];

  return (
    <main className="eq-wrap">
      <p className="eq-kicker">{v.venue}</p>
      <h1 className="eq-h1">{v.title}</h1>
      <p className="eq-lead">{v.me.name}, ce soir vous êtes <b>{v.me.char.name}</b>.</p>
      <div className="eq-acts" aria-hidden="true">{v.acts.map((a) => <span key={a.id} className={a.at ? "on" : ""} />)}</div>
      <p className="eq-actlabel">{current ? current.title : "La soirée n'a pas encore commencé"}</p>
      {err && <p className="eq-err">{err}</p>}

      {v.solution && (
        <>
          <h2 className="eq-h2">La vérité</h2>
          <div className="eq-paper">
            <span className="eq-stamp">AFFAIRE CLASSÉE</span>
            <p>{v.solution.text}</p>
          </div>
          {v.solution.results.killer && (
            <p className="eq-lead" style={{ marginTop: 14 }}>
              {v.solution.results.killerWins ? `${v.solution.results.killer.name} (${v.solution.results.killer.char}) s'en sort : la majorité ne l'a pas démasqué.` : `${v.solution.results.killer.name} (${v.solution.results.killer.char}) est démasqué.`}
            </p>
          )}
          <div className="eq-scroll">
            <table className="eq-results">
              <thead><tr><th>Joueur</th><th>A accusé</th><th>Mobile</th></tr></thead>
              <tbody>{v.solution.results.detail.map((d) => (
                <tr key={d.name}><td>{d.name}<br /><span className="eq-muted">{d.char}</span></td>
                  <td className={d.culprit ? (d.right ? "eq-yes" : "eq-no") : "eq-muted"}>{d.culprit || "—"}</td>
                  <td className={d.motive ? (d.motiveRight ? "eq-yes" : "eq-no") : "eq-muted"}>{d.motive || "—"}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="eq-h2">Votre personnage</h2>
      <div className="eq-card">
        <h3>{v.me.char.name}, {v.me.char.age} ans</h3>
        <p>{v.me.char.role}</p>
        <div><div className="eq-label">À dire en vous présentant</div><p className="eq-quote">{v.me.char.publicIntro}</p></div>
        <div><div className="eq-label">Costume</div><p>{v.me.char.costume}</p></div>
      </div>

      <h2 className="eq-h2">Dossier confidentiel</h2>
      {v.me.secret ? (
        <div className="eq-paper">
          <span className="eq-stamp">CONFIDENTIEL</span>
          <div><div className="eq-label">Votre version officielle</div><p>{v.me.official}</p></div>
          <div><div className="eq-label">Ce que vous cachez</div><p>{v.me.secret}</p></div>
          <div><div className="eq-label">Vos objectifs</div><ul>{v.me.objectives!.map((o) => <li key={o}>{o}</li>)}</ul></div>
        </div>
      ) : <p className="eq-locked">Votre dossier secret s'ouvrira au début de la soirée, quand l'animateur lancera l'acte 1. Vous recevrez un SMS.</p>}

      {v.me.clues.length > 0 && (
        <>
          <h2 className="eq-h2">Ce que vous avez appris</h2>
          <div className="eq-paper">
            <span className="eq-stamp">ACTE 2</span>
            <ul>{v.me.clues.map((c) => <li key={c}>{c}</li>)}</ul>
            <p className="eq-label">À vous de choisir à qui le révéler, et quand.</p>
          </div>
        </>
      )}

      {v.npcs.length > 0 && !v.solution && (
        <>
          <h2 className="eq-h2">Témoins à appeler</h2>
          {!v.voiceLive && <p className="eq-muted">La voix n'est pas encore configurée : les témoins répondront par écrit.</p>}
          <div className="eq-npcs">
            {v.npcs.map((n) => (
              <div className="eq-npc" key={n.id}>
                <div className="eq-face" aria-hidden="true">{n.initials}</div>
                <div><h4>{n.name}</h4><p>{n.role}</p></div>
                <button type="button" className="eq-btn-call" onClick={() => { unlockAudio(); setCalling(n); }}>{PHONE}Appeler</button>
              </div>
            ))}
          </div>
          <p className="eq-muted" style={{ marginTop: 8 }}>Mettez le haut-parleur pour que tout le monde entende… ou pas.</p>
        </>
      )}

      {v.lab && (
        <>
          <h2 className="eq-h2">Rapport du labo</h2>
          <div className="eq-paper"><span className="eq-stamp">ACTE 3</span><ul>{v.lab.map((l) => <li key={l}>{l}</li>)}</ul></div>
        </>
      )}

      {v.vote && (
        <>
          <h2 className="eq-h2">Votre accusation</h2>
          <form className="eq-form" onSubmit={vote}>
            <div className="eq-label">Qui a tué Victor ?</div>
            <div className="eq-choices">
              {v.vote.suspects.map((s) => (
                <label className="eq-choice" key={s.id}><input type="radio" name="culprit" id={`c-${s.id}`} value={s.id} checked={culprit === s.id} onChange={() => setCulprit(s.id)} />{s.name}{s.id === v.me.char.id ? " (vous)" : ""}</label>
              ))}
            </div>
            <div className="eq-label" style={{ marginTop: 8 }}>Pourquoi ?</div>
            <div className="eq-choices">
              {v.vote.motives.map((m) => (
                <label className="eq-choice" key={m.id}><input type="radio" name="motive" id={`m-${m.id}`} value={m.id} checked={motive === m.id} onChange={() => setMotive(m.id)} />{m.label}</label>
              ))}
            </div>
            <button className="eq-btn" type="submit" disabled={!culprit || !motive}>{v.vote.mine ? "Changer mon vote" : "Accuser"}</button>
            {voteMsg && <p className="eq-muted">{voteMsg}</p>}
          </form>
        </>
      )}

      <h2 className="eq-h2">Les suspects</h2>
      <div className="eq-npcs">
        {v.cast.map((c) => (
          <div className="eq-card" key={c.char}>
            <p><b>{c.char}</b>{c.me ? " · vous" : ` · joué par ${c.name}`}</p>
            <p className="eq-muted">{c.role}</p>
            <p className="eq-quote">{c.publicIntro}</p>
          </div>
        ))}
      </div>

      <h2 className="eq-h2">Ce que tout le monde sait</h2>
      <p className="eq-lead">{v.facts}</p>
      <p className="eq-muted">Gardez cette page ouverte : elle se met à jour toute seule, {first}.</p>

      {calling && <Call npc={calling} base={base} onClose={() => setCalling(null)} />}
    </main>
  );
}
