import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { useStaff } from "@/hooks/useStaff";
import { cn } from "@/lib/utils";

export interface TipAllocation {
  staff_id: string;
  amount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  totalTipAmount: number;
  defaultStaffIds: string[];
  initial?: TipAllocation[];
  onConfirm: (allocations: TipAllocation[]) => void;
}

function round3(n: number) { return Math.round(n * 1000) / 1000; }

function splitEqually(total: number, n: number): number[] {
  if (n <= 0) return [];
  const each = round3(total / n);
  const arr = Array(n).fill(each);
  const drift = round3(total - each * n);
  arr[0] = round3(arr[0] + drift);
  return arr;
}

export function TipAllocationDialog({
  open, onOpenChange, totalTipAmount, defaultStaffIds, initial, onConfirm,
}: Props) {
  const staffHook: any = useStaff();
  const staff: any[] = staffHook?.staff ?? staffHook?.data ?? [];
  const activeStaff = useMemo(
    () => staff.filter((s: any) => s.is_active !== false),
    [staff],
  );

  const [rows, setRows] = useState<TipAllocation[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initial && initial.length) { setRows(initial); return; }
    const uniqueIds = Array.from(new Set(defaultStaffIds.filter(Boolean)));
    const amounts = splitEqually(totalTipAmount, Math.max(1, uniqueIds.length));
    if (uniqueIds.length === 0) {
      setRows([{ staff_id: "", amount: totalTipAmount }]);
    } else {
      setRows(uniqueIds.map((sid, i) => ({ staff_id: sid, amount: amounts[i] ?? 0 })));
    }
  }, [open, defaultStaffIds, totalTipAmount, initial]);

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalOk = Math.abs(total - totalTipAmount) < 0.001;
  const dupIds = new Set(rows.map(r => r.staff_id).filter(Boolean));
  const hasDup = dupIds.size !== rows.filter(r => r.staff_id).length;
  const allValid = rows.every(r => r.staff_id) && totalOk && !hasDup;

  const addRow = () => setRows(prev => [...prev, { staff_id: "", amount: 0 }]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<TipAllocation>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const equalSplit = () => {
    const amounts = splitEqually(totalTipAmount, rows.length);
    setRows(prev => prev.map((r, i) => ({ ...r, amount: amounts[i] ?? 0 })));
  };

  const save = () => {
    if (!allValid) return;
    onConfirm(rows.filter(r => r.amount > 0));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Split tip · {totalTipAmount.toFixed(3)} KWD</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {rows.map((row, i) => {
            const others = new Set(rows.filter((_, j) => j !== i).map(r => r.staff_id));
            return (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Stylist</Label>
                  <Select value={row.staff_id} onValueChange={(v) => updateRow(i, { staff_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select stylist" /></SelectTrigger>
                    <SelectContent>
                      {activeStaff.filter((s: any) => !others.has(s.id)).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Label className="text-xs">Amount (KD)</Label>
                  <Input type="number" min={0} step="0.001"
                    value={row.amount}
                    onChange={(e) => updateRow(i, { amount: Number(e.target.value) || 0 })}
                  />
                </div>
                <Button variant="ghost" size="icon" disabled={rows.length === 1}
                  onClick={() => removeRow(i)} aria-label="Remove">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add stylist
            </Button>
            <Button variant="ghost" size="sm" onClick={equalSplit}>Equal split</Button>
          </div>
        </div>
        <DialogFooter className="items-center justify-between sm:justify-between">
          <p className={cn("text-sm font-medium", totalOk ? "text-emerald-600" : "text-red-500")}>
            {total.toFixed(3)} / {totalTipAmount.toFixed(3)} KWD{hasDup && " · duplicate staff"}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={!allValid}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
