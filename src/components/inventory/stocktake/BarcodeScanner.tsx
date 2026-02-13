import { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
}

export const BarcodeScanner = ({ open, onOpenChange, onScan }: Props) => {
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopScanner();
      return;
    }

    let cancelled = false;

    const startScanner = async () => {
      // Dynamic import to avoid SSR issues
      const { Html5Qrcode } = await import('html5-qrcode');

      if (cancelled || !containerRef.current) return;

      const scannerId = 'barcode-scanner-region';
      // Ensure the container div exists
      if (!document.getElementById(scannerId)) {
        const div = document.createElement('div');
        div.id = scannerId;
        containerRef.current.appendChild(div);
      }

      const scanner = new Html5Qrcode(scannerId);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 120 },
            aspectRatio: 1.5,
          },
          (decodedText: string) => {
            onScan(decodedText);
            // Don't stop — allow continuous scanning
          },
          () => {
            // ignore scan failures (no code in frame)
          }
        );
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'Camera access denied. Please allow camera permissions.');
      }
    };

    // Small delay to let dialog render
    const timer = setTimeout(startScanner, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopScanner();
    };
  }, [open, onScan, stopScanner]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Scan Barcode
          </DialogTitle>
        </DialogHeader>
        <div ref={containerRef} className="w-full min-h-[260px] rounded-lg overflow-hidden bg-black">
          {/* Scanner will render here */}
        </div>
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
        <p className="text-xs text-muted-foreground text-center">
          Point camera at a product barcode. Each scan increments the count by 1.
        </p>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
          <X className="h-4 w-4 mr-1" /> Close Scanner
        </Button>
      </DialogContent>
    </Dialog>
  );
};
