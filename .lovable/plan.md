## Goal
Publish the app and make it installable on iPhone via "Add to Home Screen".

## Why PWA is needed
Safari on iPhone requires a Web App Manifest to show the **Add to Home Screen** option. Without it, users can only bookmark the page in Safari.

## Plan

### 1. Update site metadata (`src/routes/__root.tsx`)
Replace generic "Lovable App" / "Lovable Generated Project" with real app info:
- Title: "Whoop Companion"
- Description: something accurate to the app
- `og:title`, `og:description`, `og:type`
- `twitter:card`, `twitter:title`, `twitter:description`

### 2. Create Web App Manifest (`public/manifest.webmanifest`)
- `name`: "Whoop Companion"
- `short_name`: "Whoop"
- `display`: "standalone"
- `theme_color` / `background_color`: matching the app's primary colors
- `icons`: 192x192 and 512x512 PNG icons
- `start_url`: "/"

### 3. Generate app icons
Create a 512x512 app icon (and a 192x192 variant) saved to `public/` for the manifest and as `apple-touch-icon`.

### 4. Wire manifest + icons into `<head>` (`src/routes/__root.tsx`)
Add to `head.links`:
- `<link rel="manifest" href="/manifest.webmanifest" />`
- `<link rel="apple-touch-icon" ... />`
- `theme-color` meta tag

### 5. Run security preflight & publish
- Confirm no unresolved critical security findings
- Publish the app to make it live at a `.lovable.app` URL

## What the user will do on iPhone
After publishing, open the live URL in Safari → tap the **Share** button → **Add to Home Screen**. The app will appear as a standalone icon that launches full-screen without Safari chrome.

## Scope
- Manifest-only home-screen support (no service worker / offline cache, since offline mode was not requested).