import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Android package name and iOS bundle identifier.
  // Using 'ai.zaina.app' as reverse-DNS of a plausible production domain.
  // Hard to change after the first Play Console upload, so fixing early.
  appId: 'ai.zaina.app',

  // Display name shown under the launcher icon and in app settings.
  // Kept short — Android has a ~12-character practical limit before
  // the launcher truncates.  Full name appears inside the app header.
  appName: 'Zaina',

  // The web build Capacitor will wrap.  vite build outputs here.
  webDir: 'dist',

  // Native plugin configuration.  Kept explicit so defaults don't drift.
  plugins: {
    SplashScreen: {
      launchShowDuration:    1500,
      launchAutoHide:        true,
      backgroundColor:       '#111827', // matches PWA theme
      androidScaleType:      'CENTER_CROP',
      showSpinner:           false,
      splashFullScreen:      true,
      splashImmersive:       true,
    },

    StatusBar: {
      style:                 'dark',     // dark text on light bg for iOS dark-mode toggle
      backgroundColor:       '#ffffff',
      overlaysWebView:       false,
    },

    PushNotifications: {
      // When a push arrives while the app is foregrounded, show it as a
      // banner so cashiers see it even when they're staring at POS.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },

  // Live-reload during `ionic cap run` dev sessions.  Production
  // builds ignore this.  Commented out by default — uncomment with
  // your dev machine's IP when actively iterating on-device.
  // server: {
  //   url: 'http://192.168.1.100:8080',
  //   cleartext: true,
  // },

  android: {
    // Allow cleartext HTTP to localhost for dev builds only; production
    // APKs talk to Supabase exclusively over HTTPS so this is a no-op.
    allowMixedContent: false,
    captureInput:      true,
    webContentsDebuggingEnabled: true, // chrome://inspect on debug builds
  },
};

export default config;
