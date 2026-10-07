import type { CapacitorConfig } from "@capacitor/cli";

// The native app is a shell that loads the published site, so the server-rendered
// app, sign-in and payments keep working unchanged inside the store app.
const config: CapacitorConfig = {
  appId: "app.lovable.shadowsociety",
  appName: "Mafia",
  webDir: "public",
  server: {
    url: "https://shadow-society.lovable.app",
    cleartext: false,
  },
  plugins: {
    AdMob: {
      // Replace with your AdMob app IDs in the native projects (see MOBILE.md).
    },
  },
};

export default config;
