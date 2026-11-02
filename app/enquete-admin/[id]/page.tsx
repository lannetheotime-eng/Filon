"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { play, stopAudio, unlockAudio } from "../../../components/enquete/audio";

type Host = {
  id: string; title: string; smsLive: boolean; voiceLive: boolean; votes: number;
  players: { name: string; phone: string; char: string; link: string; voted: boolean }[];
  acts: { id: string; title: string; hint: string; at: number | null }[];
  surprise: { sent: boolean; dueAt: number | null };
  sms: { at: number; to: string; kind: string; status: "sent" | "test" | "error"; error?: string; body: string }[];
  commissaire: Record<"acte1" | "acte2" | "acte3" | "revelation", boolean>;
  results: { killerWins: boolean; killer: { name: string; char: string } | null; detail: { name: string; char: string; culprit: string | null; motive: string | null; right: boolean; motiveRight: boolean }[] } | null;
};

const time = (t: number) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="eq-btn-ghost" onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }, () => {})}>
      {ok ? "Copié" : "Copier le lien"}
    </button>
  );
}

export default function HostPage() {
  const { id } = useParams<{ id: string }>();
  const [h, setH] = useState<Host | null>(null);
  const [err, setErr] = useState("");
  const [arming, setArming] = useState("");
  const [busy, setBusy] = useState("");
  const [voice, setVoice] = useState("");
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/enquete/admin/${id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setH(j); setErr("");
    } catch (e: any) { setErr(e.message || "Connexion perdue."); }
  }, [id]);

  useEffect(() => { load(); const t = setInterval(load, 15000); const c = setInterval(() => setNow(Date.now()), 1000); return () => { clearInterval(t); clearInterval(c); }; }, [load]);

  async function launch(act: string) {
    if (arming !== act) { setArming(act); return; }
    setArming(""); setBusy(act); setErr("");
    try {
      const r = await fetch(`/api/enquete/admin/${id}/act`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ act }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setH(j);
    } catch (e: any) { setErr(e.message); } finally { setBusy(""); }
  }

  async function speak(line: string) {
    unlockAudio();
    stopAudio();
    setVoice(line);
    const ok = await play(`/api/enquete/admin/${id}/voice?line=${line}`, { end: () => setVoice("") });
    if (!ok) { setVoice(""); setErr("Le commissaire ne peut pas parler : vérifiez la clé OpenAI et le volume."); }
  }

  if (!h) return <main className="eq-wrap"><p className="eq-muted">{err || "Chargement de la partie…"}</p></main>;
  const lines: Record<string, string> = { acte1: "acte1", acte2: "acte2", acte3: "acte3", revelation: "revelation" };

  return (
    <main className="eq-wrap">
      <p className="eq-kicker">Tableau de bord de l'animateur · partie {h.id}</p>
      <h1 className="eq-h1">{h.title}</h1>
      <div style={{ display: "grid", gap: 8 }}>
        {!h.smsLive && <p className="eq-banner">Mode test : aucun SMS ne part. Les textes s'affichent plus bas. Ajoutez vos identifiants Twilio sur Vercel pour envoyer de vrais SMS.</p>}
        {!h.voiceLive && <p className="eq-banner">La voix n'est pas configurée : ajoutez OPENAI_API_KEY sur Vercel pour faire parler le commissaire et les témoins.</p>}
        {err && <p className="eq-err">{err}</p>}
      </div>

      <h2 className="eq-h2">Déroulé de la soirée</h2>
      <div className="eq-players">
        {h.acts.map((a) => {
          const done = !!a.at;
          const line = lines[a.id];
          return (
            <section key={a.id} className={`eq-actcard${done ? " done" : ""}`}>
              <h4>{a.title}{done && <span className="eq-muted"> · lancé à {time(a.at!)}</span>}</h4>
              <p>{a.hint}</p>
              <div className="eq-actrow">
                {!done && (
                  <button type="button" className="eq-btn" disabled={!!busy} onClick={() => launch(a.id)}>
                    {busy === a.id ? "Envoi…" : arming === a.id ? (a.id === "revelation" ? "Confirmer la révélation" : "Confirmer l'envoi des SMS") : a.id === "revelation" ? "Révéler" : "Lancer"}
                  </button>
                )}
                {done && line && h.commissaire[line as keyof Host["commissaire"]] && (
                  <button type="button" className="eq-btn-ghost" onClick={() => speak(line)}>{voice === line ? "Le commissaire parle…" : "Faire parler le commissaire"}</button>
                )}
              </div>
              {a.id === "acte2" && done && (
                <p className="eq-muted">{h.surprise.sent ? "Témoin surprise envoyé." : h.surprise.dueAt ? `Témoin surprise par SMS dans ${Math.max(0, Math.ceil((h.surprise.dueAt - now) / 60000))} min (gardez cette page ouverte).` : ""}</p>
              )}
              {a.id === "acte3" && done && !h.results && <p className="eq-muted">{h.votes} vote{h.votes > 1 ? "s" : ""} sur {h.players.length}.</p>}
            </section>
          );
        })}
      </div>

      {h.results && (
        <>
          <h2 className="eq-h2">Résultats</h2>
          {h.results.killer && <p className="eq-lead">{h.results.killerWins ? `${h.results.killer.name} (${h.results.killer.char}) gagne : il n'a pas été démasqué.` : `${h.results.killer.name} (${h.results.killer.char}) est démasqué.`}</p>}
          <div className="eq-scroll">
            <table className="eq-results">
              <thead><tr><th>Joueur</th><th>A accusé</th><th>Mobile</th></tr></thead>
              <tbody>{h.results.detail.map((d) => (
                <tr key={d.name}><td>{d.name}<br /><span className="eq-muted">{d.char}</span></td>
                  <td className={d.culprit ? (d.right ? "eq-yes" : "eq-no") : "eq-muted"}>{d.culprit || "—"}</td>
                  <td className={d.motive ? (d.motiveRight ? "eq-yes" : "eq-no") : "eq-muted"}>{d.motive || "—"}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="eq-h2">Joueurs</h2>
      <div className="eq-players">
        {h.players.map((p) => (
          <div className="eq-player" key={p.link}>
            <div><b>{p.name} · {p.char}</b><span>{p.phone || "pas de numéro"}{h.acts.find((a) => a.id === "acte3")?.at ? (p.voted ? " · a voté" : " · n'a pas voté") : ""}</span></div>
            <Copy text={p.link} />
          </div>
        ))}
      </div>

      <h2 className="eq-h2">SMS envoyés</h2>
      {h.sms.length === 0 ? <p className="eq-muted">Aucun SMS pour l'instant.</p> : (
        <div className="eq-smslog">
          {[...h.sms].reverse().map((s, i) => (
            <div className="eq-sms" key={i}>
              <span>{time(s.at)} · {s.kind} → {s.to} · </span>
              <span className={`st-${s.status}`}>{s.status === "sent" ? "envoyé" : s.status === "test" ? "mode test" : `échec : ${s.error}`}</span>
              {" "}<button type="button" className="eq-replay" style={{ display: "inline" }} onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}>{open[i] ? "Masquer" : "Voir le texte (spoiler)"}</button>
              {open[i] && <pre>{s.body}</pre>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
