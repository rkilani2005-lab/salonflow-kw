/**
 * Push notification wrapper over @capacitor/push-notifications.
 *
 * Lifecycle:
 *   1. App boot → initializePushNotifications() on native only.
 *   2. User grants OS permission (first-time only).
 *   3. FCM (Android) registers the device and returns a push token.
 *   4. We persist the token to Supabase so the backend can target
 *      this device for bookings / low-stock / shift alerts.
 *   5. When a push arrives:
 *      • Foreground → shown as a banner (see capacitor.config.ts).
 *      • Background tap → app opens, we route based on payload.data.
 *
 * Requires Firebase setup on the Android side — specifically
 * android/app/google-services.json.  Without that file, registration
 * silently fails on device.  The repo ships without a real
 * google-services.json; we document the missing-file path in the
 * Phase C README for the person who sets up the Firebase project.
 */

import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed,
} from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

let initialized = false;

/**
 * Call once at app startup on native platforms.  Idempotent — safe to
 * call multiple times (guarded by the `initialized` flag).
 */
export async function initializePushNotifications(userId: string | null) {
  if (!Capacitor.isNativePlatform()) return;
  if (initialized) return;
  initialized = true;

  // Request permission.  On Android 13+ this shows a system dialog;
  // on earlier Android it's a silent grant.
  const permStatus = await PushNotifications.requestPermissions();
  if (permStatus.receive !== 'granted') {
    // User declined — nothing more to do until they flip the system
    // toggle in app settings.  Don't retry on every app open.
    return;
  }

  // Register with APNS/FCM.  The token listener below fires with the
  // device token a few hundred ms later.
  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token: Token) => {
    if (!userId) return;
    // Persist to Supabase so the backend can target this device.
    // Upsert by (user_id, device_token) so a returning user doesn't
    // create duplicate rows.
    try {
      await (supabase as any).from('device_push_tokens').upsert(
        {
          user_id:      userId,
          device_token: token.value,
          platform:     Capacitor.getPlatform(),
          updated_at:   new Date().toISOString(),
        },
        { onConflict: 'user_id,device_token' },
      );
    } catch {
      // Table may not exist yet — flagged in Phase C README as needing
      // a dedicated migration.  Fail quiet: push just won't target
      // this device until the table is provisioned.
    }
  });

  PushNotifications.addListener('registrationError', err => {
    // No user-facing action — this is usually a misconfigured Firebase
    // project or missing google-services.json.  Log for debugging.
    console.warn('[push] Registration error:', err);
  });

  PushNotifications.addListener(
    'pushNotificationReceived',
    (notification: PushNotificationSchema) => {
      // Foreground: the system shows the banner automatically (see
      // presentationOptions in capacitor.config.ts).  We can also
      // refresh relevant queries here if payload.data.refresh = 'bookings'.
      const refresh = (notification.data as any)?.refresh;
      if (refresh && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('zaina-push-refresh', { detail: refresh }));
      }
    },
  );

  PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => {
      // User tapped the notification — if payload carries a route,
      // dispatch it so App.tsx can navigate.
      const route = (action.notification.data as any)?.route;
      if (route && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('zaina-push-navigate', { detail: route }));
      }
    },
  );
}
