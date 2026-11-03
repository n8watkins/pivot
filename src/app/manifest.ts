import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pivot - A small next step",
    short_name: "Pivot",
    description: "A calm pause space for choosing a different next step when an urge appears.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f7f2",
    theme_color: "#4d6d5a",
    orientation: "portrait-primary",
    categories: ["health", "lifestyle"],
    icons: [
      { src: "/icons/pivot-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/pivot-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/pivot-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/pivot-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
