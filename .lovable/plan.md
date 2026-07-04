## What you need to do

Add the iOS deep-link URL to the backend's OAuth redirect allow-list so Supabase will return the session to the native app after a Google (or Apple-via-OAuth) sign-in.

## Steps

1. Open the backend dashboard by clicking **View Backend** below.

   <presentation-actions><presentation-open-backend>View Backend</presentation-open-backend></presentation-actions>

2. In the left sidebar, click **Users**.
3. Click the **Authentication Settings** (gear icon) at the top of the Users page.
4. Open the **URL Configuration** section.
5. Under **Redirect URLs** (aka "Additional Redirect URLs" / allow-list), click **Add URL** and paste:

   ```
   whoopcompanion://auth-callback
   ```

6. Also add a wildcard variant to be safe:

   ```
   whoopcompanion://**
   ```

7. Click **Save**.

That's it — no code change, no deploy. The next Google sign-in from the iOS app will land back in the app instead of getting rejected as an invalid redirect.

## Why this is needed

Supabase only redirects OAuth back to URLs on its allow-list. The web app uses `https://whoop-companion.lovable.app`, which is already allow-listed automatically. The iOS app uses a custom URL scheme (`whoopcompanion://…`) that Supabase doesn't know about until you add it.

## How to tell it worked

In the iOS app, tap **Continue with Google**. After picking your Google account, the system browser sheet should close automatically and drop you into the signed-in home screen. If it instead shows a Supabase page saying "redirect not allowed" or just hangs on a blank page, the URL wasn't saved correctly — re-check step 5.

Apple sign-in doesn't use the allow-list (it uses the native `signInWithIdToken` flow), so it will work regardless.