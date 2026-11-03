import type { Metadata } from "next";
import "./dirigeants.css";

export const metadata: Metadata = { title: "Dirigeants & holdings · exemple Nafy", description: "Trouver les entreprises détenues par une holding, par secteur et par zone, avec leurs dirigeants." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap" />
      <div className="nf">{children}</div>
    </>
  );
}
