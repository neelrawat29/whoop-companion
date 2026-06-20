import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

let initialized = false;

/**
 * Registers the device for push notifications on native platforms and stores
 * the resulting APNs/FCM token in the `device_tokens` table.
 *
 * No-op on the web.
 */
export async function registerPushNotifications(userId: string) {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) return;
  initialized = true;

  try {
    const platform = Capacitor.getPlatform() as "ios" | "android";

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return;

    await PushNotifications.removeAllListeners();

    await PushNotifications.addListener("registration", async (token) => {
      try {
        await supabase
          .from("device_tokens")
          .upsert(
            { user_id: userId, platform, token: token.value },
            { onConflict: "user_id,token" },
          );
      } catch (err) {
        console.error("[push] failed to save device token", err);
      }
    });

    await PushNotifications.addListener("registrationError", (err) => {
      console.error("[push] registration error", err);
    });

    await PushNotifications.register();
  } catch (err) {
    console.error("[push] init failed", err);
  }
}
