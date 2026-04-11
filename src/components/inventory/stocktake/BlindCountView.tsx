import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, Search, ScanBarcode } from 'lucide-react';
import { useStockTakeEntries, useUpdateEntry, useUpdateSessionStatus, useStockTakeSession } from '@/hooks/useStockTake';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { BarcodeScanner } from './BarcodeScanner';

interface Props {
  sessionId: string;
  onBack: () => void;
}

export const BlindCountView = ({ sessionId, onBack }: Props) => {
  const { data: entries, isLoading } = useStockTakeEntries(sessionId);
  const { data: session } = useStockTakeSession(sessionId);
  const updateEntry = useUpdateEntry();
  const updateStatus = useUpdateSessionStatus();
  const { user } = useAuth();
  const { toast } = useToast();
  const [localCounts, setLocalCounts] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleBarcodeScan = useCallback((barcode: string) => {
    if (!entries) return;
    const entry = entries.find(
      e => e.product?.barcode === barcode || e.product?.sku === barcode
    );
    if (!entry) {
      toast({ title: `No product found for barcode: ${barcode}`, variant: 'destructive' });
      return;
    }
    if (entry.status === 'counted' || entry.status === 'accepted') {
      toast({ title: `${entry.product?.name} already counted` });
      return;
    }
    // Increment count by 1
    const current = parseFloat(localCounts[entry.id] || '0') || 0;
    const newVal = String(current + 1);
    setLocalCounts(prev => ({ ...prev, [entry.id]: newVal }));
    toast({ title: `${entry.product?.name}: ${newVal}` });
  }, [entries, localCounts, toast]);

  // Load saved counts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`stock_take_draft_${sessionId}`);
    if (saved) {
      setLocalCounts(JSON.parse(saved));
    }
  }, [sessionId]);

  // Save counts to localStorage when they change
  useEffect(() => {
    if (Object.keys(localCounts).length > 0) {
      localStorage.setItem(`stock_take_draft_${sessionId}`, JSON.stringify(localCounts));
    }
  }, [localCounts, sessionId]);

  const handleCountChange = useCallback((entryId: string, value: string) => {
    setLocalCounts(prev => ({ ...prev, [entryId]: value }));
  }, []);

  const handleSubmitCount = async (entryId: string) => {
    const value = localCounts[entryId];
    if (value === undefined || value === '') return;
    const qty = parseFloat(value);
    if (isNaN(qty) || qty < 0) {
      toast({ title: 'Invalid quantity', variant: 'destructive' });
      return;
    }
    await updateEntry.mutateAsync({
      entryId,
      counted_quantity: qty,
      status: 'counted',
      counted_by: user?.id,
    });

    // Update session to in_progress if still open
    if (session?.status === 'open') {
      await updateStatus.mutateAsync({ sessionId, status: 'in_progress' });
    }
  };

  const submitAll = async () => {
    const pendingEntries = filteredEntries?.filter(
      e => (e.status === 'pending' || e.status === 'recounting') && localCounts[e.id] !== undefined && localCounts[e.id] !== ''
    );
    if (!pendingEntries || pendingEntries.length === 0) {
      toast({ title: 'No counts to submit' });
      return;
    }
    for (const entry of pendingEntries) {
      await handleSubmitCount(entry.id);
    }
    toast({ title: `${pendingEntries.length} counts submitted` });
    localStorage.removeItem(`stock_take_draft_${sessionId}`);
  };

  const filteredEntries = entries?.filter(e => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      e.product?.name?.toLowerCase().includes(q) ||
      e.product?.name_ar?.toLowerCase().includes(q) ||
      e.product?.sku?.toLowerCase().includes(q) ||
      e.product?.barcode?.toLowerCase().includes(q)
    );
  });

  const countedCount = entries?.filter(e => e.status === 'counted' || e.status === 'accepted').length || 0;
  const totalCount = entries?.length || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Go back" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-bold">Blind Count</h2>
          <p className="text-sm text-muted-foreground">{session?.session_name}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setScannerOpen(true)}>
          <ScanBarcode className="h-4 w-4 mr-1" /> Scan
        </Button>
        <Badge variant="outline" className="text-sm">
          {countedCount}/{totalCount} counted
        </Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, SKU, or barcode..."
          className="pl-10"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Progress */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all"
          style={{ width: `${totalCount > 0 ? (countedCount / totalCount) * 100 : 0}%` }}
        />
      </div>

      {/* Product Cards - Mobile First */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Loading products...</p>
      ) : (
        <div className="space-y-3">
          {filteredEntries?.map(entry => {
            const isCounted = entry.status === 'counted' || entry.status === 'accepted';
            const needsRecount = entry.status === 'recounting';
            return (
              <Card
                key={entry.id}
                className={`${isCounted ? 'border-green-300 bg-green-50/50' : needsRecount ? 'border-orange-300 bg-orange-50/50' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    {/* Product image */}
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {entry.product?.image_url ? (
                        <img src={entry.product.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">📦</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{entry.product?.name}</p>
                      {entry.product?.name_ar && (
                        <p className="text-xs text-muted-foreground truncate" dir="rtl">{entry.product.name_ar}</p>
                      )}
                      <div className="flex gap-2 mt-1">
                        {entry.product?.sku && (
                          <span className="text-xs text-muted-foreground">SKU: {entry.product.sku}</span>
                        )}
                        {entry.product?.barcode && (
                          <span className="text-xs text-muted-foreground">BC: {entry.product.barcode}</span>
                        )}
                      </div>
                      {needsRecount && (
                        <Badge variant="outline" className="bg-orange-100 text-orange-700 text-xs mt-1">
                          Recount requested
                        </Badge>
                      )}
                    </div>
                    {/* Count input - NO system qty shown (Blind Count) */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        className="w-20 h-12 text-center text-lg font-bold"
                        placeholder="0"
                        value={localCounts[entry.id] ?? (entry.counted_quantity !== null ? String(entry.counted_quantity) : '')}
                        onChange={e => handleCountChange(entry.id, e.target.value)}
                        disabled={isCounted && !needsRecount}
                      />
                      {!isCounted && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-12 w-12"
                          onClick={() => handleSubmitCount(entry.id)}
                          disabled={updateEntry.isPending}
                        >
                          <Check className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Submit All */}
      <div className="sticky bottom-4 flex justify-center">
        <Button size="lg" className="shadow-lg px-8" onClick={submitAll}>
          Submit All Counts
        </Button>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleBarcodeScan}
      />
    </div>
  );
};
