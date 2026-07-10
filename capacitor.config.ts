import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.cove",
  appName: "Cove",
  webDir: "dist",
  server: {
    // Load the published Lovable app so deploys flow through without rebuilding the native binary.
    // To run a fully offline/local build instead, remove `url` and `cap sync` will use `webDir`.
    url: "https://cove-companion.lovable.app",
    cleartext: false,
    iosScheme: "https",
  },
  ios: {
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: "#0F172A",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
