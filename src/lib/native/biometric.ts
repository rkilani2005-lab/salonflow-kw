/**
 * Biometric login wrapper — thin layer over capacitor-native-biometric.
 *
 * Context: salon staff log in dozens of times a day (every shift change,
 * every time they hand the tablet off).  Typing a password that many
 * times kills throughput.  Biometric unlock cuts the friction.
 *
 * Security model: we don't replace the password — we STORE the
 * authenticated session, and biometric unlock is what retrieves it.
 * The password is still needed on first login and after explicit
 * sign-out.  If biometric fails, the user falls back to password.
 *
 * This module is safe to import on web — all calls become no-ops via
 * Capacitor.isNativePlatform() guards, so no conditional imports
 * scatter through the codebase.
 */

import { Capacitor } from '@capacitor/core';
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';
import { Preferences } from '@capacitor/preferences';

const CREDENTIAL_SERVER = 'zaina.app';
const SESSION_STORAGE_KEY = 'zaina_biometric_session';

/**
 * Is biometric hardware available AND enrolled (user has registered a
 * fingerprint / face)?  Returns false on web.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

/**
 * What kind of biometric is enrolled?  Useful for tailoring the prompt
 * text ('Use Face ID' vs 'Use fingerprint' vs generic 'Use biometric').
 */
export async function getBiometryKind(): Promise<'face' | 'fingerprint' | 'iris' | 'unknown'> {
  if (!Capacitor.isNativePlatform()) return 'unknown';
  try {
    const result = await NativeBiometric.isAvailable();
    switch (result.biometryType) {
      case BiometryType.FACE_ID:
      case BiometryType.FACE_AUTHENTICATION:
        return 'face';
      case BiometryType.TOUCH_ID:
      case BiometryType.FINGERPRINT:
        return 'fingerprint';
      case BiometryType.IRIS_AUTHENTICATION:
        return 'iris';
      default:
        return 'unknown';
    }
  } catch {
    return 'unknown';
  }
}

/**
 * Store email + password after a successful password login so future
 * sessions can unlock via biometric.  Credentials go in the platform
 * keystore (Android KeyStore / iOS Keychain) via NativeBiometric —
 * NOT in Preferences or localStorage.
 */
export async function saveCredentialsForBiometric(email: string, password: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await NativeBiometric.setCredentials({
    username: email,
    password,
    server: CREDENTIAL_SERVER,
  });
  // Mark that biometric is set up so the Login screen can show the button.
  await Preferences.set({ key: SESSION_STORAGE_KEY, value: '1' });
}

/**
 * Has the user opted in to biometric login?
 */
export async function isBiometricEnabled(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const { value } = await Preferences.get({ key: SESSION_STORAGE_KEY });
  return value === '1';
}

/**
 * Prompt the user for biometric verification, then retrieve the stored
 * credentials.  Callers pass the result to Supabase auth.  Returns null
 * if the user cancels or biometric fails.
 */
export async function unlockWithBiometric(): Promise<{ email: string; password: string } | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    // First verify identity.
    await NativeBiometric.verifyIdentity({
      reason:       'Unlock Zaina',
      title:        'Zaina login',
      subtitle:     'Use your fingerprint or face to sign in',
      description:  'Your salon is waiting for you.',
    });
    // Then retrieve stored credentials.
    const creds = await NativeBiometric.getCredentials({ server: CREDENTIAL_SERVER });
    return { email: creds.username, password: creds.password };
  } catch {
    return null;
  }
}

/**
 * Disable biometric login and wipe stored credentials.  Called when the
 * user signs out explicitly or toggles biometric off in settings.
 */
export async function disableBiometric(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await NativeBiometric.deleteCredentials({ server: CREDENTIAL_SERVER });
  } catch { /* no-op if nothing saved */ }
  await Preferences.remove({ key: SESSION_STORAGE_KEY });
}
