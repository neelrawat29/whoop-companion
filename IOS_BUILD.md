# Building the iOS App (Capacitor)

This project is wrapped with [Capacitor](https://capacitorjs.com) so it can be
installed on your iPhone as a real native app — no App Store required.

## Requirements

- A **Mac** with Xcode 15+ installed (Lovable's Linux sandbox cannot build iOS).
- An Apple ID (free is fine for personal sideloading; paid Apple Developer
  account — $99/yr — is required for working push notifications and longer
  install lifetimes).
- Node 20+ and [Bun](https://bun.sh) installed locally.

## First-time setup on your Mac

```bash
# 1. Clone the repo and install deps
bun install

# 2. Build the web app (Capacitor needs `dist/` even when using a remote URL)
bun run build

# 3. Add the iOS platform (creates the `ios/` Xcode project)
npx cap add ios

# 4. Generate app icon + splash from src/assets
#    (Optional but recommended — uses @capacitor/assets)
npx capacitor-assets generate --ios \
  --iconBackgroundColor "#0F172A" \
  --splashBackgroundColor "#0F172A"

# 5. Copy web assets + native plugin configs into the iOS project
npx cap sync ios

# 6. Open in Xcode
npx cap open ios
```

## In Xcode

1. Select the project in the left sidebar → **Signing & Capabilities**.
2. Set your **Team** to your Apple ID. Xcode will auto-provision a signing
   certificate.
3. (For push notifications) Click **+ Capability** and add **Push Notifications**.
4. Plug in your iPhone, select it as the run destination, click ▶ Run.

The app will install on your phone. With a free Apple ID it works for **7 days**,
then needs to be re-run from Xcode. With a paid developer account it lasts
**1 year**.

## Sideloading without Xcode

After building once in Xcode you can also distribute the resulting `.ipa` via:

- [AltStore](https://altstore.io/) — re-signs apps with your Apple ID on-device.
- [Sideloadly](https://sideloadly.io/) — desktop app for installing IPAs.

## Updating the app

Because `capacitor.config.ts` points at the published Lovable URL
(`https://cove-companion.lovable.app`), most updates ship automatically — the
app reloads the latest web build on next launch.

You only need to rebuild the native binary when:

- Upgrading Capacitor or a native plugin (`bun add` + `npx cap sync ios`).
- Changing native config in `capacitor.config.ts`.
- Updating icons, splash, or signing.

## Switching to a fully offline / bundled build

Open `capacitor.config.ts` and remove the `server.url` field. Then:

```bash
bun run build
npx cap sync ios
```

This bundles `dist/` directly into the app instead of loading from the web.
Note that server functions still require network access regardless.

## Push notifications

The app already registers for push tokens on launch and stores them in the
`device_tokens` table in Lovable Cloud. To actually send a notification you'll
need to:

1. Create an APNs key in your Apple Developer account.
2. Add a server function that calls APNs with the stored token.

That sending side is intentionally not included yet — ping the assistant when
you're ready to wire it up.
