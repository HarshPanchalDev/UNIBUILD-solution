// PWA manifest (served at /manifest.webmanifest)
export default function manifest() {
  return {
    name: "UNIBUILD Partner App",
    short_name: "UNIBUILD",
    description: "Earn points for bringing business to UNIBUILD. Track points, sites and rewards.",
    start_url: "/partner",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f7fb",
    theme_color: "#0b2a57",
    lang: "hi",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
