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

export interface ItemStaffAllocation {
  staff_id: string;
  allocation_percent: number;
  role_in_service?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  itemName: string;
  defaultStaffId: string | null;
  initial?: ItemStaffAllocation[];
  onConfirm: (allocations: ItemStaffAllocation[]) => void;
}

export function StaffAllocationDialog({
  open, onOpenChange, itemName, defaultStaffId, initial, onConfirm,
}: Props) {
  const staffHook: any = useStaff();
  const staff: any[] = staffHook?.staff ?? staffHook?.data ?? [];
  const activeStaff = useMemo(
    () => staff.filter((s: any) => s.is_active !== false),
    [staff],
  );

  const [rows, setRows] = useState<ItemStaffAllocation[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initial && initial.length) {
      setRows(initial);
    } else {
      setRows([{ staff_id: defaultStaffId ?? "", allocation_percent: 100 }]);
    }
  }, [open, defaultStaffId, initial]);

  const total = rows.reduce((s, r) => s + (Number(r.allocation_percent) || 0), 0);
  const totalOk = Math.abs(total - 100) < 0.01;
  const dupIds = new Set(rows.map(r => r.staff_id).filter(Boolean));
  const hasDup = dupIds.size !== rows.filter(r => r.staff_id).length;
  const allValid = rows.every(r => r.staff_id) && totalOk && !hasDup;

  const addRow = () => {
    const remainder = Math.max(0, 100 - total);
    const equalSplit = Number((100 / (rows.length + 1)).toFixed(2));
    setRows(prev => {
      const split = prev.map(r => ({ ...r, allocation_percent: equalSplit }));
      return [...split, { staff_id: "", allocation_percent: Number((100 - equalSplit * prev.length).toFixed(2)) || remainder }];
    });
  };

  const updateRow = (i: number, patch: Partial<ItemStaffAllocation>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const removeRow = (i: number) =>
    setRows(prev => prev.filter((_, idx) => idx !== i));

  const save = () => {
    if (!allValid) return;
    onConfirm(rows);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Split stylists — {itemName}</DialogTitle>
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
                <div className="w-20">
                  <Label className="text-xs">%</Label>
                  <Input type="number" min={0} max={100} step="0.01"
                    value={row.allocation_percent}
                    onChange={(e) => updateRow(i, { allocation_percent: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Role</Label>
                  <Input placeholder="Color / Blow-dry / Style"
                    value={row.role_in_service ?? ""}
                    onChange={(e) => updateRow(i, { role_in_service: e.target.value })}
                  />
                </div>
                <Button variant="ghost" size="icon" disabled={rows.length === 1}
                  onClick={() => removeRow(i)} aria-label="Remove">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Add stylist
          </Button>
        </div>
        <DialogFooter className="items-center justify-between sm:justify-between">
          <p className={cn("text-sm font-medium", totalOk ? "text-emerald-600" : "text-red-500")}>
            Total: {total.toFixed(2)}%{hasDup && " · duplicate staff"}
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
