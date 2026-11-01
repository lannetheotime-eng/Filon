import "./globals.css";
import "leaflet/dist/leaflet.css";
import type { Metadata } from "next";

export const viewport = { themeColor: "#050506", width: "device-width", initialScale: 1, viewportFit: "cover" as const };

export const metadata: Metadata = {
  appleWebApp: { capable: true, title: "Filon", statusBarStyle: "default" },
  title: "Filon",
  description: "Trouve les entreprises sans site web autour de toi, appelle-les avec un script prêt et prépare leur site.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Space+Grotesk:wght@500;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
