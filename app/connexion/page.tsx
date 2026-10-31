"use client";
import { useEffect, useState } from "react";

export default function Connexion() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [info, setInfo] = useState<{ enabled: boolean; first?: boolean; open?: boolean } | null>(null);
  const [form, setForm] = useState({ email: "", password: "", name: "", invite: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const invite = new URLSearchParams(location.search).get("invitation");
    if (invite) { setForm((f) => ({ ...f, invite })); setMode("signup"); }
    fetch("/api/auth/signup").then((r) => r.json()).then((j) => {
      setInfo(j);
      if (j.first) setMode("signup");
    }).catch(() => setInfo({ enabled: false }));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      location.href = "/";
    } catch (e: any) {
      setErr(e.message || "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="logo"><i aria-hidden />Filon</div>
        <h1>{mode === "login" ? "Connexion" : info?.first ? "Crée ton compte administrateur" : "Créer un compte"}</h1>
        {info?.first && <p className="hint">C'est le premier compte : il aura tous les droits et pourra inviter d'autres personnes.</p>}
        {info && !info.enabled && <p className="error">Les comptes ne sont pas encore activés sur cette installation.</p>}
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label className="field">Prénom<input id="name" value={form.name} onChange={set("name")} autoComplete="given-name" required /></label>
          )}
          <label className="field">E-mail<input id="email" type="email" value={form.email} onChange={set("email")} autoComplete="email" required /></label>
          <label className="field">Mot de passe<input id="password" type="password" value={form.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "signup" ? 8 : undefined} required /></label>
          {mode === "signup" && !info?.first && !info?.open && (
            <label className="field">Code d'invitation<input id="invite" value={form.invite} onChange={set("invite")} required /></label>
          )}
          {err && <p className="error">{err}</p>}
          <button className="btn big" type="submit" disabled={busy || (info !== null && !info.enabled)}>
            {busy ? "Un instant…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>
        {!info?.first && (
          <button className="link" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }}>
            {mode === "login" ? "J'ai une invitation : créer un compte" : "J'ai déjà un compte : me connecter"}
          </button>
        )}
      </div>
    </main>
  );
}
