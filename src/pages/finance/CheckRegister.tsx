import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChecks, useCreateCheck, useUpdateCheckStatus, type Check } from '@/hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AsyncSection } from '@/components/ui/state-primitives';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Printer, CheckCircle2, XCircle, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string,string> = {
  draft:   'bg-muted text-muted-foreground',
  printed: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  issued:  'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  cleared: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  voided:  'bg-muted text-muted-foreground line-through',
  bounced: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
};

// Check print template
function CheckPrint({ check, currency, tenantName }: { check: Check; currency: string; tenantName: string }) {
  return (
    <div className="p-8 border-2 border-gray-800 rounded-lg w-[680px] font-mono text-sm bg-white text-black">
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="font-bold text-lg">{tenantName}</p>
          <p className="text-xs text-gray-600">Kuwait</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Check No.</p>
          <p className="font-bold text-lg">{check.check_number}</p>
        </div>
      </div>
      <div className="flex justify-between mb-4">
        <div><p className="text-xs text-gray-500">Date</p><p className="font-semibold">{format(new Date(check.check_date),'MMMM d, yyyy')}</p></div>
        <div className="text-right"><p className="text-xs text-gray-500">Bank</p><p className="font-semibold">{check.bank_name}</p></div>
      </div>
      <div className="mb-4 p-3 border border-gray-300 rounded">
        <p className="text-xs text-gray-500 mb-1">Pay to the Order of</p>
        <p className="font-bold text-base border-b border-gray-400 pb-1">{check.payee_name}</p>
      </div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex-1 border border-gray-300 rounded p-2 mr-4">
          <p className="text-xs text-gray-500">Amount in Words</p>
          <p className="font-semibold">{check.memo || '— — —'}</p>
        </div>
        <div className="border-2 border-gray-800 rounded p-3 min-w-[140px] text-center">
          <p className="text-xs text-gray-500">{currency}</p>
          <p className="font-bold text-2xl">{Number(check.amount).toFixed(3)}</p>
        </div>
      </div>
      <div className="flex justify-between pt-4 border-t border-gray-400">
        <div><p className="text-xs text-gray-500">Memo</p><p>{check.memo||'—'}</p></div>
        <div className="text-right border-t border-gray-800 pt-1 min-w-[200px]">
          <p className="text-xs text-gray-500">Authorized Signature</p>
        </div>
      </div>
    </div>
  );
}

export default function CheckRegister() {
  const { language } = useLanguage();
  const { tenant } = useAuth();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';
  const printRef = useRef<HTMLDivElement>(null);

  const { data: checks, isLoading } = useChecks();
  const createCheck = useCreateCheck();
  const updateStatus = useUpdateCheckStatus();

  const [showAdd, setShowAdd] = useState(false);
  const [printCheck, setPrintCheck] = useState<Check|null>(null);
  const [form, setForm] = useState({ check_number:'', check_date: format(new Date(),'yyyy-MM-dd'), payee_name:'', payee_type:'supplier', amount:'', bank_name:'', bank_account:'', memo:'', status:'draft' as Check['status'] });

  const totalIssued = (checks||[]).filter(c=>c.status==='issued').reduce((s,c)=>s+Number(c.amount),0);
  const totalCleared = (checks||[]).filter(c=>c.status==='cleared').reduce((s,c)=>s+Number(c.amount),0);
  const totalPending = (checks||[]).filter(c=>['draft','printed','issued'].includes(c.status)).reduce((s,c)=>s+Number(c.amount),0);

  const handleCreate = async () => {
    if (!form.check_number||!form.payee_name||!form.amount||!form.bank_name) return;
    await createCheck.mutateAsync({ ...form, amount: parseFloat(form.amount)||0, issued_date: null, cleared_date: null } as any);
    setShowAdd(false);
    setForm({ check_number:'', check_date: format(new Date(),'yyyy-MM-dd'), payee_name:'', payee_type:'supplier', amount:'', bank_name:'', bank_account:'', memo:'', status:'draft' });
  };

  const handlePrint = (check: Check) => {
    setPrintCheck(check);
    updateStatus.mutate({ id: check.id, status: 'printed' });
    setTimeout(() => { window.print(); }, 300);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">{ar?'المالية':'Finance'}</p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>{ar?'سجل الشيكات':'Check Register'}</h1>
          <p className="text-sm text-muted-foreground mt-1">{ar?'إصدار وطباعة وإقفال الشيكات':'Issue, print and clear checks'}</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5"/>{ar?'إصدار شيك جديد':'New Check'}</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: ar?'إجمالي المعلق':'Total Pending', val: totalPending, color: 'text-amber-600' },
          { label: ar?'إجمالي الصادر':'Total Issued',  val: totalIssued,  color: 'text-blue-600' },
          { label: ar?'إجمالي المقبوض':'Total Cleared', val: totalCleared, color: 'text-emerald-600' },
        ].map(({ label, val, color }) => (
          <Card key={label} className="border"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={cn('stat-number text-xl font-bold', color)}>{val.toFixed(3)} {currency}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card className="border">
        <CardContent className="p-0">
          <AsyncSection
            loading={isLoading}
            empty={!checks?.length}
            loadingVariant="table"
            loadingRows={4}
            emptyState={{
              icon: CreditCard,
              title: ar ? 'لا توجد شيكات' : 'No checks yet',
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-muted/40">
                  <th className="text-left py-3 px-4 font-semibold">{ar?'رقم الشيك':'Check #'}</th>
                  <th className="text-left py-3 px-4 font-semibold">{ar?'التاريخ':'Date'}</th>
                  <th className="text-left py-3 px-4 font-semibold">{ar?'المستفيد':'Payee'}</th>
                  <th className="text-left py-3 px-4 font-semibold">{ar?'البنك':'Bank'}</th>
                  <th className="text-right py-3 px-4 font-semibold">{ar?'المبلغ':'Amount'}</th>
                  <th className="text-center py-3 px-4 font-semibold">{ar?'الحالة':'Status'}</th>
                  <th className="text-center py-3 px-4 font-semibold">{ar?'إجراءات':'Actions'}</th>
                </tr></thead>
                <tbody>
                  {checks.map((c,i) => (
                    <tr key={c.id} className={cn('border-b last:border-0 hover:bg-muted/20',i%2===0&&'bg-muted/5')}>
                      <td className="py-2.5 px-4 font-mono font-bold text-primary">{c.check_number}</td>
                      <td className="py-2.5 px-4">{format(new Date(c.check_date),'dd MMM yyyy')}</td>
                      <td className="py-2.5 px-4 font-medium">{c.payee_name}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{c.bank_name}</td>
                      <td className="py-2.5 px-4 text-right font-bold">{Number(c.amount).toFixed(3)} {currency}</td>
                      <td className="py-2.5 px-4 text-center">
                        <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-full font-semibold', STATUS_COLORS[c.status]||'')}>{c.status}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {['draft','printed'].includes(c.status) && (
                            <Button size="sm" variant="outline" onClick={()=>handlePrint(c)} className="h-6 w-6 p-0">
                              <Printer className="h-3 w-3"/>
                            </Button>
                          )}
                          {c.status === 'issued' && (
                            <Button size="sm" variant="outline" onClick={()=>updateStatus.mutate({id:c.id,status:'cleared',cleared_date:format(new Date(),'yyyy-MM-dd')})} className="h-6 w-6 p-0 text-emerald-600">
                              <CheckCircle2 className="h-3 w-3"/>
                            </Button>
                          )}
                          {!['cleared','voided'].includes(c.status) && (
                            <Button size="sm" variant="outline" onClick={()=>updateStatus.mutate({id:c.id,status:'voided'})} className="h-6 w-6 p-0 text-red-500">
                              <XCircle className="h-3 w-3"/>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncSection>
        </CardContent>
      </Card>

      {/* Print area */}
      {printCheck && (
        <div className="hidden print:block" ref={printRef}>
          <CheckPrint check={printCheck} currency={currency} tenantName={tenant?.name||'ZAINA Salon'} />
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{ar?'إصدار شيك جديد':'Issue New Check'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{ar?'رقم الشيك':'Check Number *'}</Label><Input value={form.check_number} onChange={e=>setForm({...form,check_number:e.target.value})} placeholder="CHK-0001" className="h-9" /></div>
              <div className="space-y-1.5"><Label className="text-xs">{ar?'التاريخ':'Date *'}</Label><Input type="date" value={form.check_date} onChange={e=>setForm({...form,check_date:e.target.value})} className="h-9" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{ar?'المستفيد':'Payee Name *'}</Label><Input value={form.payee_name} onChange={e=>setForm({...form,payee_name:e.target.value})} placeholder={ar?'اسم المستفيد':'Payee name'} className="h-9" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{ar?'المبلغ':'Amount *'} ({currency})</Label><Input type="number" step="0.001" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} className="h-9" /></div>
              <div className="space-y-1.5"><Label className="text-xs">{ar?'نوع المستفيد':'Payee Type'}</Label>
                <Select value={form.payee_type} onValueChange={v=>setForm({...form,payee_type:v})}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="supplier">{ar?'مورد':'Supplier'}</SelectItem><SelectItem value="employee">{ar?'موظف':'Employee'}</SelectItem><SelectItem value="other">{ar?'أخرى':'Other'}</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{ar?'البنك':'Bank Name *'}</Label><Input value={form.bank_name} onChange={e=>setForm({...form,bank_name:e.target.value})} placeholder={ar?'اسم البنك':'Bank name'} className="h-9" /></div>
            <div className="space-y-1.5"><Label className="text-xs">{ar?'رقم الحساب':'Account Number'}</Label><Input value={form.bank_account} onChange={e=>setForm({...form,bank_account:e.target.value})} placeholder="IBAN / Account #" className="h-9" /></div>
            <div className="space-y-1.5"><Label className="text-xs">{ar?'البيان':'Memo'}</Label><Input value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})} placeholder={ar?'سبب الدفع':'Payment memo'} className="h-9" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={()=>setShowAdd(false)}>{ar?'إلغاء':'Cancel'}</Button>
            <Button size="sm" onClick={handleCreate} disabled={createCheck.isPending||!form.check_number||!form.payee_name||!form.amount||!form.bank_name}>
              {createCheck.isPending?(ar?'جارٍ الإصدار...':'Creating...'):(ar?'إصدار الشيك':'Issue Check')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
