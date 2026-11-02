import type { MetadataRoute } from "next";

/**
 * Lets the phone install Donna to the home screen and open her full-screen.
 * No service worker: nothing is cached offline (AGENTS.md invariant 8, no browser persistence).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Donna — MoatazOS",
    short_name: "Donna",
    description: "Your chief of staff for real-estate sales. Synthetic data only.",
    start_url: "/app-studio/donna",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/donna-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/donna-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/donna-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
