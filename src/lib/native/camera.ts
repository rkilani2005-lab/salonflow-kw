/**
 * Camera wrapper — thin layer over @capacitor/camera.
 *
 * Use cases in the salon app:
 *  1. Product photos when adding inventory
 *  2. Receipt capture for expense logging
 *  3. Client profile photos (future)
 *  4. Barcode / QR scanning for fast product lookup (uses the camera
 *     picker with inline crop; barcode-specific scanner deferred)
 *
 * Falls back to a web <input type="file" accept="image/*" capture> on
 * non-native platforms so the same calling code works everywhere.
 */

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, type Photo } from '@capacitor/camera';

export interface CapturedImage {
  /** Data URL (base64) ready for Supabase upload or <img src={}>. */
  dataUrl: string;
  /** File format ('jpeg' | 'png' | 'webp') from the native capture. */
  format: string;
}

export async function capturePhoto(opts?: {
  /** 'camera' — force camera.  'library' — pick from gallery.  Default: prompt. */
  source?: 'camera' | 'library' | 'prompt';
  /** JPEG quality 0-100.  Default 80 — good balance for receipts and products. */
  quality?: number;
}): Promise<CapturedImage | null> {
  const quality = opts?.quality ?? 80;

  if (!Capacitor.isNativePlatform()) {
    // Web fallback — standard file input.
    return await webFilePicker();
  }

  try {
    const sourceMap = {
      camera:  CameraSource.Camera,
      library: CameraSource.Photos,
      prompt:  CameraSource.Prompt,
    } as const;

    const photo: Photo = await Camera.getPhoto({
      quality,
      resultType: CameraResultType.DataUrl,
      source: sourceMap[opts?.source ?? 'prompt'],
      // Let the user crop-rotate before accepting — matters for receipts
      // that are shot at an angle.
      allowEditing: true,
      // Width cap so we don't ship 12MP images to Supabase Storage.
      // 1600px is enough for receipts and products without bloat.
      width: 1600,
    });

    if (!photo.dataUrl) return null;
    return { dataUrl: photo.dataUrl, format: photo.format };
  } catch {
    // User cancelled, or permission denied, or hardware missing.
    return null;
  }
}

async function webFilePicker(): Promise<CapturedImage | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // `capture` hints mobile browsers to use the camera directly
    // rather than show a file chooser.  Harmless on desktop.
    input.setAttribute('capture', 'environment');
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve({
        dataUrl: reader.result as string,
        format:  file.type.split('/')[1] || 'jpeg',
      });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
