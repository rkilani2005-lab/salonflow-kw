import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useExpenses, useCreateExpense, useChartOfAccounts, type ExpenseEntry } from '@/hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Receipt, Download, Filter } from 'lucide-react';
import { exportCSV } from '@/lib/exportUtils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  draft:            'bg-muted text-muted-foreground',
  pending_approval: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  approved:         'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  paid:             'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  accrued:          'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300',
  rejected:         'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
};

const EXPENSE_CATEGORIES = [
  'Staff Salaries','Staff Commissions','Rent','Utilities','Marketing','Supplies',
  'Maintenance','Insurance','Professional Fees','Products - COGS','Other',
];

export default function ExpenseManager() {
  const { language } = useLanguage();
  const { tenant } = useAuth();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';

  const now = new Date();
  const [from, setFrom] = useState(format(startOfMonth(now),'yyyy-MM-dd'));
  const [to,   setTo]   = useState(format(endOfMonth(now),'yyyy-MM-dd'));
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState('all');

  const { data: expenses, isLoading } = useExpenses(from, to);
  const { data: accounts } = useChartOfAccounts();
  const createExpense = useCreateExpense();

  const expenseAccounts = (accounts||[]).filter(a => a.account_type === 'expense');

  const [form, setForm] = useState({
    expense_date: format(now,'yyyy-MM-dd'),
    category: '',
    description: '',
    amount: '',
    tax_amount: '0',
    total_amount: '',
    cost_type: 'indirect' as 'direct'|'indirect',
    status: 'draft' as ExpenseEntry['status'],
    is_accrual: false,
    accrual_period: '',
    payment_method: 'cash',
    check_number: '',
    account_id: '',
  });

  const filtered = (expenses||[]).filter(e => filter === 'all' || e.status === filter);
  const totalAmount = filtered.reduce((s,e) => s + Number(e.total_amount),0);
  const directCosts = filtered.filter(e => e.cost_type === 'direct').reduce((s,e)=>s+Number(e.total_amount),0);
  const indirectCosts = filtered.filter(e => e.cost_type === 'indirect').reduce((s,e)=>s+Number(e.total_amount),0);

  const handleSubmit = async () => {
    if (!form.category || !form.description || !form.amount) return;
    const amt = parseFloat(form.amount)||0;
    const tax = parseFloat(form.tax_amount)||0;
    await createExpense.mutateAsync({
      ...form,
      amount: amt,
      tax_amount: tax,
      total_amount: amt + tax,
      account_id: form.account_id || null,
      accrual_period: form.accrual_period || null,
      check_number: form.check_number || null,
      payment_method: form.payment_method || null,
      receipt_url: null,
      supplier_id: null,
      branch_id: null,
    } as any);
    setShowAdd(false);
    setForm({ expense_date: format(now,'yyyy-MM-dd'), category:'', description:'', amount:'', tax_amount:'0', total_amount:'', cost_type:'indirect', status:'draft', is_accrual:false, accrual_period:'', payment_method:'cash', check_number:'', account_id:'' });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">{ar?'المالية':'Finance'}</p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>{ar?'إدارة المصروفات':'Expense Management'}</h1>
          <p className="text-sm text-muted-foreground mt-1">{ar?'التكاليف المباشرة وغير المباشرة والاستحقاقات':'Direct & indirect costs, accruals'}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-9"
            onClick={() => {
              const rows = filtered.map(e => ({
                date: e.expense_date, category: e.category, description: e.description,
                amount: Number(e.amount).toFixed(3), tax: Number(e.tax_amount).toFixed(3),
                total: Number(e.total_amount).toFixed(3), status: e.status, type: e.cost_type,
              }));
              exportCSV(rows, 'expenses', { date: 'Date', category: 'Category', description: 'Description', amount: `Amount (${currency})`, tax: 'Tax', total: 'Total', status: 'Status', type: 'Type' });
            }}>
            <Download className="h-3.5 w-3.5"/>{ar?'CSV':'CSV'}
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5"/>{ar?'إضافة مصروف':'Add Expense'}</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: ar?'إجمالي المصروفات':'Total Expenses', val: totalAmount, color: 'text-foreground' },
          { label: ar?'تكاليف مباشرة (COGS)':'Direct Costs (COGS)', val: directCosts, color: 'text-amber-600' },
          { label: ar?'مصروفات غير مباشرة':'Indirect (Overhead)', val: indirectCosts, color: 'text-primary' },
        ].map(({ label, val, color }) => (
          <Card key={label} className="border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={cn('stat-number text-xl font-bold', color)}>{val.toFixed(3)} {currency}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + date range */}
      <div className="flex flex-wrap items-center gap-3">
        <Input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="h-8 w-36 text-xs" />
        <span className="text-muted-foreground text-xs">→</span>
        <Input type="date" value={to} onChange={e=>setTo(e.target.value)} className="h-8 w-36 text-xs" />
        <div className="flex gap-1.5 ml-2">
          {['all','draft','pending_approval','approved','paid','accrued'].map(s => (
            <Button key={s} size="sm" variant={filter===s?'default':'outline'} onClick={()=>setFilter(s)}
              className="h-7 text-xs px-2.5 capitalize">{s === 'all' ? (ar?'الكل':'All') : s.replace('_',' ')}</Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="border">
        <CardContent className="p-0">
          {isLoading ? <div className="p-4 space-y-2">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
          : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Receipt className="h-8 w-8 mb-2 opacity-40"/>
              <p className="text-sm">{ar?'لا توجد مصروفات في هذه الفترة':'No expenses in this period'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-muted/40">
                  <th className="text-left py-3 px-4 font-semibold">{ar?'الرقم':'#'}</th>
                  <th className="text-left py-3 px-4 font-semibold">{ar?'التاريخ':'Date'}</th>
                  <th className="text-left py-3 px-4 font-semibold">{ar?'الفئة':'Category'}</th>
                  <th className="text-left py-3 px-4 font-semibold">{ar?'الوصف':'Description'}</th>
                  <th className="text-center py-3 px-4 font-semibold">{ar?'النوع':'Type'}</th>
                  <th className="text-right py-3 px-4 font-semibold">{ar?'المبلغ':'Amount'}</th>
                  <th className="text-center py-3 px-4 font-semibold">{ar?'الحالة':'Status'}</th>
                </tr></thead>
                <tbody>
                  {filtered.map((e, i) => (
                    <tr key={e.id} className={cn('border-b last:border-0 hover:bg-muted/20 transition-colors', i%2===0&&'bg-muted/5')}>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">{e.expense_number}</td>
                      <td className="py-2.5 px-4">{format(new Date(e.expense_date),'dd MMM yyyy')}</td>
                      <td className="py-2.5 px-4 font-medium">{e.category}</td>
                      <td className="py-2.5 px-4 text-muted-foreground max-w-[200px] truncate">{e.description}</td>
                      <td className="py-2.5 px-4 text-center">
                        <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-full font-semibold',
                          e.cost_type==='direct'?'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300':'bg-muted text-muted-foreground'
                        )}>{e.cost_type==='direct'?(ar?'مباشر':'Direct'):(ar?'غير مباشر':'Indirect')}</Badge>
                        {e.is_accrual && <Badge variant="outline" className="text-[9px] h-4 px-1.5 rounded-full ml-1 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">Accrual</Badge>}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold">{Number(e.total_amount).toFixed(3)}</td>
                      <td className="py-2.5 px-4 text-center">
                        <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-full font-semibold', STATUS_COLORS[e.status]||'')}>{e.status.replace('_',' ')}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{ar?'إضافة مصروف جديد':'Add New Expense'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{ar?'التاريخ':'Date'}</Label>
                <Input type="date" value={form.expense_date} onChange={e=>setForm({...form,expense_date:e.target.value})} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{ar?'الفئة':'Category'}</Label>
                <Select value={form.category} onValueChange={v=>setForm({...form,category:v})}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={ar?'اختر فئة':'Select category'}/></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{ar?'الوصف':'Description'}</Label>
              <Textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={2} className="text-sm resize-none" placeholder={ar?'وصف المصروف':'Expense description'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{ar?'المبلغ':'Amount'} ({currency})</Label>
                <Input type="number" step="0.001" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value,total_amount:String(parseFloat(e.target.value||'0')+(parseFloat(form.tax_amount)||0))})} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{ar?'الضريبة':'Tax'} ({currency})</Label>
                <Input type="number" step="0.001" value={form.tax_amount} onChange={e=>setForm({...form,tax_amount:e.target.value})} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{ar?'نوع التكلفة':'Cost Type'}</Label>
                <Select value={form.cost_type} onValueChange={v=>setForm({...form,cost_type:v as any})}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">{ar?'مباشر (COGS)':'Direct (COGS)'}</SelectItem>
                    <SelectItem value="indirect">{ar?'غير مباشر (Overhead)':'Indirect (Overhead)'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{ar?'طريقة الدفع':'Payment Method'}</Label>
                <Select value={form.payment_method} onValueChange={v=>setForm({...form,payment_method:v})}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{ar?'نقداً':'Cash'}</SelectItem>
                    <SelectItem value="knet">KNET</SelectItem>
                    <SelectItem value="bank_transfer">{ar?'تحويل بنكي':'Bank Transfer'}</SelectItem>
                    <SelectItem value="check">{ar?'شيك':'Check'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.payment_method === 'check' && (
              <div className="space-y-1.5">
                <Label className="text-xs">{ar?'رقم الشيك':'Check Number'}</Label>
                <Input value={form.check_number} onChange={e=>setForm({...form,check_number:e.target.value})} className="h-9" placeholder="CHK-0001" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">{ar?'الحساب المحاسبي':'Account'}</Label>
              <Select value={form.account_id} onValueChange={v=>setForm({...form,account_id:v})}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={ar?'اختر حساباً':'Select account'} /></SelectTrigger>
                <SelectContent>{expenseAccounts.map(a=><SelectItem key={a.id} value={a.id}>{a.code} — {ar&&a.name_ar?a.name_ar:a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
              <Switch checked={form.is_accrual} onCheckedChange={v=>setForm({...form,is_accrual:v})} />
              <div>
                <p className="text-xs font-medium">{ar?'استحقاق':'Accrual Basis'}</p>
                <p className="text-[10px] text-muted-foreground">{ar?'سجّل المصروف في فترة وقوعه':'Record expense in the period it occurred'}</p>
              </div>
              {form.is_accrual && (
                <Input value={form.accrual_period} onChange={e=>setForm({...form,accrual_period:e.target.value})}
                  placeholder="2026-03" className="h-8 w-28 text-xs ml-auto" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{ar?'الحالة':'Status'}</Label>
              <Select value={form.status} onValueChange={v=>setForm({...form,status:v as any})}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="accrued">Accrued</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={()=>setShowAdd(false)}>{ar?'إلغاء':'Cancel'}</Button>
            <Button size="sm" onClick={handleSubmit} disabled={createExpense.isPending||!form.category||!form.description||!form.amount}>
              {createExpense.isPending ? (ar?'جارٍ الحفظ...':'Saving...') : (ar?'حفظ المصروف':'Save Expense')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
