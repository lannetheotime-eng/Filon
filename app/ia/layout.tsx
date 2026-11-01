import type { Metadata } from "next";
import "./cite.css";

export const metadata: Metadata = {
  title: "Cité · Les IA recommandent-elles votre commerce ?",
  description: "Testez gratuitement si ChatGPT, Gemini et les autres IA citent votre établissement quand vos clients leur demandent où aller.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="cite">{children}</div>;
}
