"use client";
import { useEffect } from "react";

// Petite notification en bas d'écran, qui confirme une action puis disparaît
export default function Toast({ msg, onDone }: { msg: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  return (
    <div className={`toast ${msg ? "show" : ""}`} role="status" aria-live="polite">
      <i aria-hidden />
      {msg}
    </div>
  );
}
