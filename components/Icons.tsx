// Icônes au trait, 24px, couleur héritée
const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconScan = () => (
  <svg {...base}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /><path d="M11 8v6M8 11h6" /></svg>
);
export const IconBoard = () => (
  <svg {...base}><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></svg>
);
export const IconStats = () => (
  <svg {...base}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
export const IconSettings = () => (
  <svg {...base}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></svg>
);
export const IconRoute = () => (
  <svg {...base}><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" /></svg>
);
export const IconMail = () => (
  <svg {...base}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6 8.5-6" /></svg>
);
export const IconMap = () => (
  <svg {...base}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></svg>
);
export const IconList = () => (
  <svg {...base}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></svg>
);
