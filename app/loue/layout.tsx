import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vendu loué",
  description: "Les biens vendus avec leur locataire : prix, surface Carrez, prix au m², loyer et rentabilité brute.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
