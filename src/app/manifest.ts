import type { MetadataRoute } from "next";
import { APP_NAME } from "@/config";

/** Installable on phone and desktop; opens on Today. iOS needs it on the Home Screen for push. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Mỗi ngày gần hơn với cuộc sống bạn muốn.",
    lang: "vi",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#3d6fb0",
    theme_color: "#6aa4dc",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
