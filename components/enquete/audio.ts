"use client";

// Un seul lecteur audio pour toute la page. Sur iPhone, un son ne peut démarrer qu'après un toucher :
// on « réveille » ce lecteur au premier geste, puis il peut jouer les réponses qui arrivent plus tard.
let el: HTMLAudioElement | null = null;
let silent = "";

function silentWav() {
  if (silent) return silent;
  const rate = 8000, n = 800;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  silent = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  return silent;
}

export function player() {
  if (!el) {
    el = new Audio();
    el.setAttribute("playsinline", "");
    el.preload = "auto";
  }
  return el;
}

// À appeler dans le gestionnaire du toucher (bouton Appeler, Envoyer…)
export function unlockAudio() {
  const a = player();
  if (a.dataset.unlocked) return;
  try {
    a.src = silentWav();
    const p = a.play();
    if (p) p.then(() => { a.dataset.unlocked = "1"; }).catch(() => {});
  } catch {}
}

export async function play(src: string, on?: { start?: () => void; end?: () => void }) {
  const a = player();
  a.onplaying = () => on?.start?.();
  a.onended = a.onpause = () => on?.end?.();
  a.src = src;
  try {
    await a.play();
    return true;
  } catch {
    on?.end?.();
    return false;
  }
}

export function stopAudio() {
  try { player().pause(); } catch {}
}
