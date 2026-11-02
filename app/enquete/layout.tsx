import type { Metadata } from "next";
import "./enquete.css";

export const metadata: Metadata = {
  title: "La dernière bouteille · Murder party",
  description: "Votre dossier d'enquête pour la soirée.",
  robots: { index: false },
};


export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,500;1,6..96,500&family=Manrope:wght@400;500;600;700&family=Courier+Prime:wght@400;700&display=swap" />
      <div className="eq">{children}</div>
    </>
  );
}
