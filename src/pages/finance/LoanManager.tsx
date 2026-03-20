import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLoans, useCreateLoan, useRecordLoanRepayment, type Loan } from '@/hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Landmark, ChevronDown, ChevronUp } from 'lucide-react';
import { format, differenceInMonths } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string,string> = {
  active:       'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  paid_off:     'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  defaulted:    'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
  restructured: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
};

export default function LoanManager() {
  const { language } = useLanguage();
  const { tenant } = useAuth();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';

  const { data: loans, isLoading } = useLoans();
  const createLoan = useCreateLoan();
  const recordRepayment = useRecordLoanRepayment();

  const [showAdd, setShowAdd] = useState(false);
  const [showRepay, setShowRepay] = useState<Loan|null>(null);
  const [expanded, setExpanded] = useState<string|null>(null);

  const [loanForm, setLoanForm] = useState({ lender_name:'', lender_type:'bank', principal:'', interest_rate:'0', start_date:format(new Date(),'yyyy-MM-dd'), maturity_date:'', currency:'KWD', notes:'' });
  const [repayForm, setRepayForm] = useState({ payment_date:format(new Date(),'yyyy-MM-dd'), principal_payment:'', interest_payment:'0', check_number:'', reference_number:'' });

  const totalOutstanding = (loans||[]).filter(l=>l.status==='active').reduce((s,l)=>s+Number(l.outstanding_balance),0);
  const totalPrincipal   = (loans||[]).reduce((s,l)=>s+Number(l.principal),0);

  const handleCreateLoan = async () => {
    if (!loanForm.lender_name||!loanForm.principal) return;
    const p = parseFloat(loanForm.principal)||0;
    await createLoan.mutateAsync({ ...loanForm, principal: p, interest_rate: parseFloat(loanForm.interest_rate)||0, outstanding_balance: p, status: 'active', maturity_date: loanForm.maturity_date||null, notes: loanForm.notes||null, liability_account_id: null, journal_entry_id: null } as any);
    setShowAdd(false);
    setLoanForm({ lender_name:'', lender_type:'bank', principal:'', interest_rate:'0', start_date:format(new Date(),'yyyy-MM-dd'), maturity_date:'', currency:'KWD', notes:'' });
  };

  const handleRepayment = async () => {
    if (!showRepay||!repayForm.principal_payment) return;
    const pp = parseFloat(repayForm.principal_payment)||0;
    const ip = parseFloat(repayForm.interest_payment)||0;
    await recordRepayment.mutateAsync({
      loan_id: showRepay.id,
      payment_date: repayForm.payment_date,
      principal_payment: pp, interest_payment: ip, total_payment: pp+ip,
      check_number: repayForm.check_number||null,
      reference_number: repayForm.reference_number||null,
      current_balance: Number(showRepay.outstanding_balance),
      journal_entry_id: null,
    });
    setShowRepay(null);
    setRepayForm({ payment_date:format(new Date(),'yyyy-MM-dd'), principal_payment:'', interest_payment:'0', check_number:'', reference_number:'' });
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">{ar?'المالية':'Finance'}</p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>{ar?'القروض والتمويل':'Loans & Financing'}</h1>
          <p className="text-sm text-muted-foreground mt-1">{ar?'إدارة القروض والأقساط والفوائد':'Manage loans, repayments and interest'}</p>
        </div>
        <Button size="sm" onClick={()=>setShowAdd(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5"/>{ar?'إضافة قرض':'Add Loan'}</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="border"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">{ar?'إجمالي القروض القائمة':'Total Outstanding Loans'}</p>
          <p className="stat-number text-2xl font-bold text-primary">{totalOutstanding.toFixed(3)} {currency}</p>
        </CardContent></Card>
        <Card className="border"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">{ar?'إجمالي رأس المال المقترض':'Total Borrowed'}</p>
          <p className="stat-number text-2xl font-bold">{totalPrincipal.toFixed(3)} {currency}</p>
        </CardContent></Card>
      </div>

      {isLoading ? [...Array(3)].map((_,i)=><Skeleton key={i} className="h-20 w-full rounded-xl"/>) :
      !loans?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Landmark className="h-8 w-8 mb-2 opacity-40"/>
          <p className="text-sm">{ar?'لا توجد قروض مسجلة':'No loans recorded'}</p>
        </div>
      ) : loans.map(loan => {
        const paid = Number(loan.principal) - Number(loan.outstanding_balance);
        const paidPct = Number(loan.principal) > 0 ? (paid / Number(loan.principal)) * 100 : 0;
        return (
          <Card key={loan.id} className="border">
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0">
                  <Landmark className="h-5 w-5 text-violet-600 dark:text-violet-300"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-sm">{loan.lender_name}</p>
                    <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-full font-semibold', STATUS_COLORS[loan.status]||'')}>{loan.status.replace('_',' ')}</Badge>
                    <span className="text-[10px] font-mono text-muted-foreground ml-auto">{loan.loan_number}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs mb-3">
                    <div><p className="text-muted-foreground">{ar?'رأس المال':'Principal'}</p><p className="font-semibold">{Number(loan.principal).toFixed(3)} {currency}</p></div>
                    <div><p className="text-muted-foreground">{ar?'الرصيد القائم':'Outstanding'}</p><p className="font-bold text-primary">{Number(loan.outstanding_balance).toFixed(3)} {currency}</p></div>
                    <div><p className="text-muted-foreground">{ar?'نسبة الفائدة':'Interest Rate'}</p><p className="font-semibold">{loan.interest_rate}% {ar?'سنوياً':'p.a.'}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width:`${paidPct}%` }}/>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{Math.round(paidPct)}% {ar?'مسدد':'paid'}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {loan.status === 'active' && (
                    <Button size="sm" variant="outline" onClick={()=>setShowRepay(loan)} className="h-7 text-xs">{ar?'تسجيل قسط':'Record Payment'}</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={()=>setExpanded(expanded===loan.id?null:loan.id)} className="h-7 text-xs">
                    {expanded===loan.id?<ChevronUp className="h-3.5 w-3.5"/>:<ChevronDown className="h-3.5 w-3.5"/>}
                  </Button>
                </div>
              </div>
            </div>
            {expanded===loan.id && loan.repayments && loan.repayments.length>0 && (
              <div className="border-t border-border/50 bg-muted/20 p-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{ar?'سجل الأقساط':'Repayment History'}</p>
                <div className="space-y-1.5">
                  {loan.repayments.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-xs bg-card rounded-lg px-3 py-2 border border-border/50">
                      <span className="text-muted-foreground">{format(new Date(r.payment_date),'dd MMM yyyy')}</span>
                      <span className="font-medium">{ar?'أصل:':'Principal:'} {Number(r.principal_payment).toFixed(3)}</span>
                      <span className="text-amber-600">{ar?'فائدة:':'Interest:'} {Number(r.interest_payment).toFixed(3)}</span>
                      <span className="font-bold">{ar?'إجمالي:':'Total:'} {Number(r.total_payment).toFixed(3)} {currency}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {/* Add Loan */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{ar?'إضافة قرض جديد':'Add New Loan'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label className="text-xs">{ar?'اسم الجهة المقرضة':'Lender Name *'}</Label><Input value={loanForm.lender_name} onChange={e=>setLoanForm({...loanForm,lender_name:e.target.value})} placeholder={ar?'اسم البنك أو الجهة':'Bank or lender name'} className="h-9"/></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{ar?'نوع الجهة':'Lender Type'}</Label>
                <Select value={loanForm.lender_type} onValueChange={v=>setLoanForm({...loanForm,lender_type:v})}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="bank">{ar?'بنك':'Bank'}</SelectItem><SelectItem value="shareholder">{ar?'مساهم':'Shareholder'}</SelectItem><SelectItem value="family">{ar?'عائلة':'Family'}</SelectItem><SelectItem value="other">{ar?'أخرى':'Other'}</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">{ar?'رأس المال':'Principal *'} ({currency})</Label><Input type="number" step="0.001" value={loanForm.principal} onChange={e=>setLoanForm({...loanForm,principal:e.target.value})} className="h-9"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{ar?'نسبة الفائدة السنوية':'Interest Rate (% p.a.)'}</Label><Input type="number" step="0.1" value={loanForm.interest_rate} onChange={e=>setLoanForm({...loanForm,interest_rate:e.target.value})} className="h-9"/></div>
              <div className="space-y-1.5"><Label className="text-xs">{ar?'تاريخ البدء':'Start Date'}</Label><Input type="date" value={loanForm.start_date} onChange={e=>setLoanForm({...loanForm,start_date:e.target.value})} className="h-9"/></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{ar?'تاريخ الاستحقاق':'Maturity Date'}</Label><Input type="date" value={loanForm.maturity_date} onChange={e=>setLoanForm({...loanForm,maturity_date:e.target.value})} className="h-9"/></div>
            <div className="space-y-1.5"><Label className="text-xs">{ar?'ملاحظات':'Notes'}</Label><Input value={loanForm.notes} onChange={e=>setLoanForm({...loanForm,notes:e.target.value})} className="h-9" placeholder={ar?'شروط وأحكام القرض':'Loan terms and conditions'}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={()=>setShowAdd(false)}>{ar?'إلغاء':'Cancel'}</Button>
            <Button size="sm" onClick={handleCreateLoan} disabled={createLoan.isPending||!loanForm.lender_name||!loanForm.principal}>
              {createLoan.isPending?(ar?'جارٍ الحفظ...':'Saving...'):(ar?'حفظ القرض':'Save Loan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Repayment */}
      <Dialog open={!!showRepay} onOpenChange={()=>setShowRepay(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{ar?'تسجيل قسط':'Record Repayment'} — {showRepay?.lender_name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-3 rounded-xl bg-muted/40 text-xs">
              <p className="text-muted-foreground">{ar?'الرصيد القائم':'Outstanding Balance'}</p>
              <p className="font-bold text-lg stat-number">{Number(showRepay?.outstanding_balance||0).toFixed(3)} {currency}</p>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{ar?'تاريخ الدفع':'Payment Date'}</Label><Input type="date" value={repayForm.payment_date} onChange={e=>setRepayForm({...repayForm,payment_date:e.target.value})} className="h-9"/></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{ar?'مبلغ الأصل':'Principal'} *</Label><Input type="number" step="0.001" value={repayForm.principal_payment} onChange={e=>setRepayForm({...repayForm,principal_payment:e.target.value})} className="h-9"/></div>
              <div className="space-y-1.5"><Label className="text-xs">{ar?'مبلغ الفائدة':'Interest'}</Label><Input type="number" step="0.001" value={repayForm.interest_payment} onChange={e=>setRepayForm({...repayForm,interest_payment:e.target.value})} className="h-9"/></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{ar?'رقم الشيك / المرجع':'Check / Reference'}</Label><Input value={repayForm.check_number} onChange={e=>setRepayForm({...repayForm,check_number:e.target.value})} placeholder="CHK-0001 or REF#" className="h-9"/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={()=>setShowRepay(null)}>{ar?'إلغاء':'Cancel'}</Button>
            <Button size="sm" onClick={handleRepayment} disabled={recordRepayment.isPending||!repayForm.principal_payment}>
              {recordRepayment.isPending?(ar?'جارٍ الحفظ...':'Saving...'):(ar?'حفظ القسط':'Save Payment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
