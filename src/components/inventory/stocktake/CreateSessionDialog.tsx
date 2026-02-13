import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateStockTakeSession, StockTakeScope } from '@/hooks/useStockTake';
import { useStaff } from '@/hooks/useStaff';
import { useProductCategories } from '@/hooks/useProducts';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateSessionDialog = ({ open, onOpenChange }: Props) => {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<StockTakeScope>('full_store');
  const [categoryId, setCategoryId] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const { data: staff } = useStaff();
  const { data: categories } = useProductCategories();
  const createSession = useCreateStockTakeSession();

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await createSession.mutateAsync({
      session_name: name,
      scope,
      scope_filter_id: scope === 'category' ? categoryId : undefined,
      assigned_staff_ids: selectedStaff,
      notes: notes || undefined,
    });
    setName('');
    setScope('full_store');
    setCategoryId('');
    setSelectedStaff([]);
    setNotes('');
    onOpenChange(false);
  };

  const toggleStaff = (staffId: string) => {
    setSelectedStaff(prev =>
      prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Stock Take Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Session Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Monthly Full Count - Feb 2026"
            />
          </div>
          <div>
            <Label>Scope</Label>
            <Select value={scope} onValueChange={v => setScope(v as StockTakeScope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_store">Full Store</SelectItem>
                <SelectItem value="retail_only">Retail Only</SelectItem>
                <SelectItem value="professional_only">Professional / Back Bar Only</SelectItem>
                <SelectItem value="category">Specific Category</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === 'category' && (
            <div>
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Assign Staff</Label>
            <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2 mt-1">
              {staff?.filter(s => s.is_active).map(s => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedStaff.includes(s.id)}
                    onCheckedChange={() => toggleStaff(s.id)}
                  />
                  <span className="text-sm">{s.name}</span>
                  {s.name_ar && <span className="text-xs text-muted-foreground" dir="rtl">{s.name_ar}</span>}
                </label>
              ))}
              {(!staff || staff.length === 0) && (
                <p className="text-sm text-muted-foreground">No active staff found</p>
              )}
            </div>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || createSession.isPending}>
              {createSession.isPending ? 'Creating...' : 'Create Session'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
