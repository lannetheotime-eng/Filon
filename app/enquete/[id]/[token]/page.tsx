"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Leaderboard, type Row } from "../../../../components/enquete/Leaderboard";

type View = {
  title: string; venue: string; facts: string; act: string | null; actTitle: string | null; envelope: 2 | 3 | null;
  me: {
    name: string; char: { id: string; name: string; age: number; role: string; costume: string; publicIntro: string };
    official: string | null; secret: string | null; objectives: string[] | null; clues: string[];
    missionsNow: string[]; missionsAll: { id: string; act: string; text: string }[];
  };
  cast: { name: string; char: string; role: string; publicIntro: string; me: boolean }[];
  acts: { id: string; title: string; at: number | null }[];
  evidence: { envelope: number; title: string; lines: string[] }[];
  vote: { suspects: { id: string; name: string }[]; motives: { id: string; label: string }[]; mine: { culprit: string; motive: string; missions: string[] } | null } | null;
  solution: { text: string; results: { killerWins: boolean; killer: { name: string; char: string } | null; detail: Row[]; points: Record<string, number> } } | null;
};

export default function PlayerPage() {
  const { id, token } = useParams<{ id: string; token: string }>();
  const base = `${id}/${token}`;
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const [culprit, setCulprit] = useState("");
  const [motive, setMotive] = useState("");
  const [done, setDone] = useState<string[]>([]);
  const [voteMsg, setVoteMsg] = useState("");
  const [showDossier, setShowDossier] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/enquete/play/${base}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setV(j); setErr("");
      if (j.vote?.mine) {
        setCulprit((c) => c || j.vote.mine.culprit);
        setMotive((m) => m || j.vote.mine.motive);
        setDone((d) => (d.length ? d : j.vote.mine.missions || []));
      }
    } catch (e: any) { setErr(e.message || "Connexion perdue."); }
  }, [base]);

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  async function vote(e: React.FormEvent) {
    e.preventDefault();
    setVoteMsg("");
    const r = await fetch(`/api/enquete/play/${base}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ culprit, motive, missions: done }) });
    const j = await r.json().catch(() => ({}));
    setVoteMsg(r.ok ? "Vote enregistré. Vous pouvez le changer jusqu'à la révélation. Posez le téléphone !" : j.error || "Vote impossible.");
    if (r.ok) load();
  }

  if (!v) return <main className="eq-wrap"><p className="eq-muted">{err || "Ouverture du dossier…"}</p></main>;
  const toggle = (m: string) => setDone((d) => (d.includes(m) ? d.filter((x) => x !== m) : [...d, m]));
  const playing = v.act === "acte1" || v.act === "acte2" || v.act === "acte3";

  return (
    <main className="eq-wrap">
      <p className="eq-kicker">{v.venue}</p>
      <h1 className="eq-h1">{v.title}</h1>
      <p className="eq-lead">{v.me.name}, ce soir vous êtes <b>{v.me.char.name}</b>.</p>
      <div className="eq-acts" aria-hidden="true">{v.acts.map((a) => <span key={a.id} className={a.at ? "on" : ""} />)}</div>
      <p className="eq-actlabel">{v.actTitle || "La soirée n'a pas encore commencé"}</p>
      {err && <p className="eq-err">{err}</p>}

      {v.solution && (
        <>
          <h2 className="eq-h2">La vérité</h2>
          <div className="eq-paper"><span className="eq-stamp">AFFAIRE CLASSÉE</span><p>{v.solution.text}</p></div>
          {v.solution.results.killer && (
            <p className="eq-lead" style={{ marginTop: 14 }}>
              {v.solution.results.killerWins ? `${v.solution.results.killer.name} (${v.solution.results.killer.char}) s'en sort : la majorité ne l'a pas démasqué.` : `${v.solution.results.killer.name} (${v.solution.results.killer.char}) est démasqué.`}
            </p>
          )}
          <h2 className="eq-h2">Classement</h2>
          <Leaderboard rows={v.solution.results.detail} />
          <p className="eq-muted" style={{ marginTop: 8 }}>Mission réussie : {v.solution.results.points.mission} pt · bon coupable : {v.solution.results.points.culprit} pts · bon mobile : {v.solution.results.points.motive} pt · coupable non démasqué : {v.solution.results.points.killerEscapes} pts.</p>
        </>
      )}

      {playing && !v.solution && (
        <section className="eq-now" aria-label="À faire maintenant">
          <p className="eq-label">Maintenant</p>
          {v.envelope && <p className="eq-now-env">Ouvrez l'enveloppe {v.envelope} au centre de la table.</p>}
          {v.me.missionsNow.length > 0 && (
            <>
              <p className="eq-label" style={{ marginTop: 6 }}>Vos missions, à réussir en parlant</p>
              <ol className="eq-missions">{v.me.missionsNow.map((m) => <li key={m}>{m}</li>)}</ol>
            </>
          )}
          <p className="eq-muted">Lisez, mémorisez, puis posez le téléphone : tout se joue autour de la table.</p>
        </section>
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
            <div className="eq-label" style={{ marginTop: 8 }}>Vos missions réussies (soyez honnête)</div>
            <div className="eq-choices">
              {v.me.missionsAll.map((m) => (
                <label className="eq-choice" key={m.id}><input type="checkbox" id={`ms-${m.id}`} checked={done.includes(m.id)} onChange={() => toggle(m.id)} />{m.text}</label>
              ))}
            </div>
            <button className="eq-btn" type="submit" disabled={!culprit || !motive}>{v.vote.mine ? "Mettre à jour mon vote" : "Voter"}</button>
            {voteMsg && <p className="eq-muted">{voteMsg}</p>}
          </form>
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
        <>
          <button type="button" className="eq-btn-ghost" onClick={() => setShowDossier((s) => !s)} style={{ marginBottom: 10 }}>{showDossier ? "Masquer mon dossier" : "Relire mon dossier"}</button>
          {showDossier && (
            <div className="eq-paper">
              <span className="eq-stamp">CONFIDENTIEL</span>
              <div><div className="eq-label">Votre version officielle</div><p>{v.me.official}</p></div>
              <div><div className="eq-label">Ce que vous cachez</div><p>{v.me.secret}</p></div>
              <div><div className="eq-label">Vos objectifs</div><ul>{v.me.objectives!.map((o) => <li key={o}>{o}</li>)}</ul></div>
              {v.me.clues.length > 0 && <div><div className="eq-label">Ce que vous avez appris (acte 2)</div><ul>{v.me.clues.map((c) => <li key={c}>{c}</li>)}</ul></div>}
            </div>
          )}
        </>
      ) : <p className="eq-locked">Votre dossier secret s'ouvrira au début de la soirée, quand l'animateur lancera l'acte 1. Vous recevrez un SMS.</p>}

      {v.evidence.length > 0 && (
        <>
          <h2 className="eq-h2">Pièces sur la table</h2>
          <div className="eq-npcs">
            {v.evidence.map((e) => (
              <div className="eq-paper" key={e.title}><span className="eq-stamp">ENV. {e.envelope}</span><div className="eq-label">{e.title}</div><ul>{e.lines.map((l) => <li key={l}>{l}</li>)}</ul></div>
            ))}
          </div>
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
      <p className="eq-muted">Gardez cette page ouverte : elle se met à jour toute seule.</p>
    </main>
  );
}
