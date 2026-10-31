import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Filon",
    short_name: "Filon",
    description: "Trouve les entreprises sans site ou avec un site à refaire, et prépare ton approche.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f3f1",
    theme_color: "#154dff",
    lang: "fr",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
