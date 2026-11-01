"use client";
import { useEffect, useState } from "react";
import type { IaResult } from "../../../lib/ia-shared";
import { decodeIa } from "../../../lib/ia-shared";
import CiteReport from "../../../components/CiteReport";

export default function SharedReport() {
  const [r, setR] = useState<IaResult | null | undefined>(undefined);
  useEffect(() => {
    setR(decodeIa(new URLSearchParams(location.search).get("d") || ""));
  }, []);
  return (
    <main className="c-main">
      <header className="c-top">
        <a className="c-logo" href="/ia"><i />Cité</a>
        <a className="c-btn ghost small" href="/ia">Faire mon test</a>
      </header>
      {r === undefined ? null : r ? <CiteReport r={r} shared /> : <p className="c-err">Ce lien de rapport est incomplet ou abîmé.</p>}
    </main>
  );
}
