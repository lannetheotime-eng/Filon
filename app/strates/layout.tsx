import type { Metadata } from "next";
import "./strates.css";

export const metadata: Metadata = {
  title: "Strates · L'histoire visuelle de votre marque",
  description: "Entrez un site : Strates fouille les archives du web et reconstitue tous ses logos, couleurs et typographies, année par année.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      <div className="st">{children}</div>
    </>
  );
}
