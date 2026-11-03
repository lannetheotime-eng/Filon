"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { play, stopAudio, unlockAudio } from "../../../components/enquete/audio";
import { Leaderboard, type Row } from "../../../components/enquete/Leaderboard";

type Npc = { id: string; name: string; role: string; initials: string };
type Host = {
  id: string; title: string; smsLive: boolean; voiceLive: boolean; votes: number; act: string | null;
  players: { name: string; phone: string; char: string; link: string; voted: boolean }[];
  acts: { id: string; title: string; hint: string; at: number | null }[];
  grill: { seconds: number; order: { name: string; char: string }[] };
  calls: { act: string | null; allowed: boolean; used: number; total: number; perCall: number; npcs: Npc[]; current: { id: string; npc: string; questions: number; left: number } | null };
  sms: { at: number; to: string; kind: string; status: "sent" | "test" | "error"; error?: string; body: string }[];
  commissaire: Record<"acte1" | "acte2" | "acte3" | "revelation", boolean>;
  results: { killerWins: boolean; killer: { name: string; char: string } | null; detail: Row[] } | null;
};
type Line = { role: "user" | "assistant"; content: string; audio?: string };

const time = (t: number) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="eq-btn-ghost" onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }, () => {})}>
      {ok ? "Copié" : "Copier le lien"}
    </button>
  );
}

// Petit bip quand le temps du grill est écoulé
function beep() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.25, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.start(); o.stop(ctx.currentTime + 0.6);
  } catch {}
}

function Grill({ order, seconds }: { order: Host["grill"]["order"]; seconds: number }) {
  const [i, setI] = useState(-1);
  const [left, setLeft] = useState(seconds);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (i < 0 || paused) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [i, paused]);
  useEffect(() => {
    if (i < 0 || left > 0) return;
    beep();
    setI((x) => (x + 1 < order.length ? x + 1 : -2));
    setLeft(seconds);
  }, [left, i, order.length, seconds]);
  const who = order[i];
  return (
    <div className="eq-grill">
      <div className="eq-label">Le grill · {seconds / 60} min chacun, les autres posent les questions</div>
      {i === -1 && <div><button type="button" className="eq-btn" onClick={() => { unlockAudio(); setI(0); setLeft(seconds); setPaused(false); }}>Lancer le grill</button></div>}
      {i === -2 && <><p className="eq-muted">Tout le monde est passé sur le grill.</p><div><button type="button" className="eq-btn-ghost" onClick={() => { setI(0); setLeft(seconds); }}>Recommencer un tour</button></div></>}
      {who && (
        <>
          <p className="eq-grill-who">{who.char}</p>
          <p className="eq-muted" style={{ margin: 0 }}>{who.name} sur la sellette{order[i + 1] ? ` · ensuite : ${order[i + 1].char}` : ""}</p>
          <div className={`eq-grill-time${left <= 15 ? " low" : ""}`}>{mmss(left)}</div>
          <div className="eq-actrow">
            <button type="button" className="eq-btn-ghost" onClick={() => setPaused((p) => !p)}>{paused ? "Reprendre" : "Pause"}</button>
            <button type="button" className="eq-btn-ghost" onClick={() => { setLeft(seconds); setI((x) => (x + 1 < order.length ? x + 1 : -2)); }}>Suivant</button>
            <button type="button" className="eq-btn-ghost" onClick={() => setI(-1)}>Arrêter</button>
          </div>
        </>
      )}
    </div>
  );
}

function CallPanel({ gid, calls, reload }: { gid: string; calls: Host["calls"]; reload: () => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [npc, setNpc] = useState<Npc | null>(null);
  const [callId, setCallId] = useState("");
  const [left, setLeft] = useState(calls.perCall);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: 1e6 }); }, [lines, busy]);

  const store = `eq-call-${gid}-${calls.current?.id || ""}`;
  useEffect(() => {
    if (!calls.current) return;
    try { const saved = JSON.parse(localStorage.getItem(store) || "null"); if (saved && !lines.length) { setLines(saved); setCallId(calls.current.id); setLeft(calls.current.left); setNpc(calls.npcs.find((n) => n.id === calls.current!.npc) || null); } } catch {}
  }, [calls.current?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (callId) try { localStorage.setItem(`eq-call-${gid}-${callId}`, JSON.stringify(lines.map(({ role, content }) => ({ role, content })))); } catch {} }, [lines, callId, gid]);

  async function talk(id: string, history: Line[], opener: boolean) {
    setBusy(true); setNote("");
    try {
      const r = await fetch(`/api/enquete/admin/${gid}/talk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId: id, history: history.map(({ role, content }) => ({ role, content })), opener }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "La ligne a coupé.");
      const audio = j.audio ? `data:audio/mpeg;base64,${j.audio}` : undefined;
      setLines([...history, { role: "assistant", content: j.say, audio }]);
      setLeft(j.left);
      if (audio) { const ok = await play(audio, { start: () => setSpeaking(true), end: () => setSpeaking(false) }); if (!ok) setNote("Touchez « Écouter » pour entendre la réponse."); }
      else if (j.audioError) setNote("Voix indisponible : " + j.audioError);
    } catch (e: any) {
      if (opener) { setNpc(null); setLines([]); setCallId(""); }
      else setLines(history.slice(0, -1));
      setNote(e.message);
    } finally { setBusy(false); reload(); }
  }

  async function dial(n: Npc) {
    unlockAudio();
    setNote("");
    try {
      const r = await fetch(`/api/enquete/admin/${gid}/call`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ npc: n.id }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setNpc(n); setCallId(j.id); setLeft(j.left);
      const opener: Line = { role: "user", content: "[Tu décroches.]" };
      const h = lines.length && j.id === callId ? [...lines, { role: "user" as const, content: "[On te rappelle.]" }] : [opener];
      setLines(h);
      talk(j.id, h, true);
    } catch (e: any) { setNote(e.message); }
  }

  function ask(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!v || busy || left <= 0) return;
    unlockAudio(); stopAudio();
    setQ("");
    const h = [...lines, { role: "user" as const, content: v }];
    setLines(h);
    talk(callId, h, false);
  }

  const tokens = Array.from({ length: calls.total }, (_, k) => k >= calls.used);
  if (!calls.allowed && !npc) {
    return (
      <div className="eq-grill">
        <div className="eq-label">Appel au témoin</div>
        <div className="eq-tokens">{tokens.map((f, k) => <i key={k} className={f ? "full" : ""} />)}<span className="eq-muted">{calls.total - calls.used} appel{calls.total - calls.used > 1 ? "s" : ""} restant{calls.total - calls.used > 1 ? "s" : ""}</span></div>
        <p className="eq-muted">Un appel s'ouvre à l'acte 2, un autre à l'acte 3.</p>
      </div>
    );
  }

  return (
    <div className={`eq-callbox${speaking ? " eq-speaking" : ""}`}>
      <div className="eq-label">Appel au témoin · haut-parleur au milieu de la table</div>
      <div className="eq-tokens">{tokens.map((f, k) => <i key={k} className={f ? "full" : ""} />)}<span className="eq-muted">{calls.perCall} questions par appel. Le groupe décide qui appeler et quoi demander.</span></div>
      {note && !npc && <p className="eq-err">{note}</p>}
      {!npc ? (
        calls.current ? <p className="eq-muted">L'appel de cet acte est déjà passé.</p> : (
          <div className="eq-npcs">
            {calls.npcs.map((n) => (
              <div className="eq-npc" key={n.id}>
                <div className="eq-face" aria-hidden="true">{n.initials}</div>
                <div><h4>{n.name}</h4><p>{n.role}</p></div>
                <button type="button" className="eq-btn-call" onClick={() => dial(n)}>Appeler</button>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="eq-call-head" style={{ justifyItems: "start", display: "flex", gap: 12, alignItems: "center" }}>
            <div className="eq-avatar" style={{ width: 56, height: 56, fontSize: 22, margin: 0 }} aria-hidden="true">{npc.initials}</div>
            <div><h3 style={{ margin: 0 }}>{npc.name}</h3><div className="eq-call-state">{busy ? "…" : `${left} question${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""}`}</div></div>
          </div>
          <div className="eq-log" ref={logRef} aria-live="polite">
            {lines.filter((l) => !(l.role === "user" && l.content.startsWith("["))).map((l, i) => (
              <div key={i} className={`eq-msg ${l.role === "assistant" ? "them" : "me"}`}>
                {l.content}
                {l.role === "assistant" && l.audio && <button type="button" className="eq-replay" onClick={() => { unlockAudio(); play(l.audio!, { start: () => setSpeaking(true), end: () => setSpeaking(false) }); }}>Écouter</button>}
              </div>
            ))}
            {busy && <div className="eq-msg sys">{lines.some((l) => l.role === "assistant") ? `${npc.name.split(" ")[0]} réfléchit…` : "Ça sonne…"}</div>}
            {note && <div className="eq-msg sys">{note}</div>}
          </div>
          {left > 0 ? (
            <form className="eq-ask" onSubmit={ask}>
              <textarea id="eq-q" rows={1} value={q} onChange={(e) => setQ(e.target.value)} placeholder="La question choisie par le groupe…"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
              <button className="eq-send" type="submit" disabled={busy || !q.trim()} aria-label="Poser la question">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              </button>
            </form>
          ) : <p className="eq-muted">Le témoin a raccroché. Prochain appel à l'acte suivant.</p>}
          <div><button type="button" className="eq-btn-ghost" onClick={() => { stopAudio(); setNpc(null); setLines([]); setCallId(""); }}>Fermer l'appel</button></div>
        </>
      )}
    </div>
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

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/enquete/admin/${id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setH(j); setErr("");
    } catch (e: any) { setErr(e.message || "Connexion perdue."); }
  }, [id]);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  async function launch(act: string) {
    if (arming !== act) { setArming(act); return; }
    setArming(""); setBusy(act); setErr("");
    try {
      const r = await fetch(`/api/enquete/admin/${id}/act`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ act }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setH(j);
      if (act !== "invitation") speak(act);
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
  const grillAct = h.act === "acte1" || h.act === "acte2";

  return (
    <main className="eq-wrap">
      <p className="eq-kicker">Pupitre de l'animateur · partie {h.id}</p>
      <h1 className="eq-h1">{h.title}</h1>
      <div style={{ display: "grid", gap: 8 }}>
        {!h.smsLive && <p className="eq-banner">Mode test : aucun SMS ne part. Les textes s'affichent plus bas. Ajoutez vos identifiants Twilio sur Vercel pour envoyer de vrais SMS.</p>}
        {!h.voiceLive && <p className="eq-banner">La voix n'est pas configurée : ajoutez OPENAI_API_KEY sur Vercel pour faire parler le commissaire et les témoins.</p>}
        <p className="eq-muted"><a href="/enquete-admin/imprimer" target="_blank" rel="noreferrer" style={{ color: "var(--brass)" }}>Pièces à imprimer</a> · chevalets des personnages et enveloppes 2 et 3.</p>
        {err && <p className="eq-err">{err}</p>}
      </div>

      {grillAct && <><h2 className="eq-h2">Le grill</h2><Grill order={h.grill.order} seconds={h.grill.seconds} /></>}
      {(h.calls.allowed || h.calls.used > 0) && !h.results && <><h2 className="eq-h2">Le témoin</h2><CallPanel gid={h.id} calls={h.calls} reload={load} /></>}

      <h2 className="eq-h2">Déroulé de la soirée</h2>
      <div className="eq-players">
        {h.acts.map((a) => {
          const done = !!a.at;
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
                {done && a.id !== "invitation" && h.commissaire[a.id as keyof Host["commissaire"]] && (
                  <button type="button" className="eq-btn-ghost" onClick={() => speak(a.id)}>{voice === a.id ? "Le commissaire parle…" : "Réécouter le commissaire"}</button>
                )}
              </div>
              {a.id === "acte3" && done && !h.results && <p className="eq-muted">{h.votes} vote{h.votes > 1 ? "s" : ""} sur {h.players.length}.</p>}
            </section>
          );
        })}
      </div>

      {h.results && (
        <>
          <h2 className="eq-h2">Classement</h2>
          {h.results.killer && <p className="eq-lead">{h.results.killerWins ? `${h.results.killer.name} (${h.results.killer.char}) s'en sort : la majorité ne l'a pas démasqué.` : `${h.results.killer.name} (${h.results.killer.char}) est démasqué.`}</p>}
          <Leaderboard rows={h.results.detail} />
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
              {" "}<button type="button" className="eq-replay" style={{ display: "inline" }} onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}>{open[i] ? "Masquer" : "Voir le texte"}</button>
              {open[i] && <pre>{s.body}</pre>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
