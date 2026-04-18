import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useJournalEntries, useTrialBalance, useCreateJournalEntry, useChartOfAccounts } from '@/hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AsyncSection } from '@/components/ui/state-primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, BookOpen, CheckCircle2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

const SOURCE_COLORS: Record<string,string> = {
  manual:           'bg-muted text-muted-foreground',
  pos_sale:         'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  vendor_invoice:   'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  vendor_payment:   'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  expense:          'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300',
  loan_disbursement:'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300',
};

interface JournalLineForm { account_id: string; debit: string; credit: string; description: string; }

export default function GeneralLedger() {
  const { language } = useLanguage();
  const { tenant } = useAuth();
  const ar = language === 'ar';
  const currency = tenant?.currency || 'KWD';
  const now = new Date();
  const [from, setFrom] = useState(format(startOfMonth(now),'yyyy-MM-dd'));
  const [to, setTo]     = useState(format(endOfMonth(now),'yyyy-MM-dd'));
  const [showJE, setShowJE] = useState(false);
  const [expandedJE, setExpandedJE] = useState<string|null>(null);

  const { data: entries, isLoading: jeLoading } = useJournalEntries(from, to);
  const { data: trialBalance, isLoading: tbLoading } = useTrialBalance(from, to);
  const { data: accounts } = useChartOfAccounts();
  const createJE = useCreateJournalEntry();

  const [jeForm, setJeForm] = useState({ entry_date: format(now,'yyyy-MM-dd'), description: '', description_ar: '' });
  const [lines, setLines] = useState<JournalLineForm[]>([
    { account_id:'', debit:'', credit:'', description:'' },
    { account_id:'', debit:'', credit:'', description:'' },
  ]);

  const totalDebit  = lines.reduce((s,l)=>s+(parseFloat(l.debit)||0), 0);
  const totalCredit = lines.reduce((s,l)=>s+(parseFloat(l.credit)||0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.001;

  const addLine = () => setLines(l=>[...l,{account_id:'',debit:'',credit:'',description:''}]);
  const removeLine = (i:number) => setLines(l=>l.filter((_,idx)=>idx!==i));
  const updateLine = (i:number, f:string, v:string) => setLines(l=>l.map((ln,idx)=>idx===i?{...ln,[f]:v}:ln));

  const handleSubmitJE = async () => {
    if (!jeForm.description || !balanced) return;
    const validLines = lines.filter(l=>l.account_id && (parseFloat(l.debit)||0)+(parseFloat(l.credit)||0)>0);
    await createJE.mutateAsync({
      ...jeForm,
      lines: validLines.map(l=>({
        account_id: l.account_id,
        debit:  parseFloat(l.debit)||0,
        credit: parseFloat(l.credit)||0,
        description: l.description||undefined,
      })),
    });
    setShowJE(false);
    setLines([{account_id:'',debit:'',credit:'',description:''},{account_id:'',debit:'',credit:'',description:''}]);
    setJeForm({entry_date:format(now,'yyyy-MM-dd'),description:'',description_ar:''});
  };

  const tbTotalDebit   = (trialBalance||[]).reduce((s,a)=>s+(a.totalDebit||0),0);
  const tbTotalCredit  = (trialBalance||[]).reduce((s,a)=>s+(a.totalCredit||0),0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">{ar?'المحاسبة':'Accounting'}</p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>{ar?'دفتر الأستاذ العام':'General Ledger'}</h1>
          <p className="text-sm text-muted-foreground mt-1">{ar?'القيود اليومية وميزان المراجعة':'Journal entries & trial balance'}</p>
        </div>
        <Button size="sm" onClick={() => setShowJE(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5"/>{ar?'قيد يومي جديد':'New Journal Entry'}</Button>
      </div>

      <div className="flex items-center gap-3">
        <Input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="h-8 w-36 text-xs" />
        <span className="text-muted-foreground text-xs">→</span>
        <Input type="date" value={to} onChange={e=>setTo(e.target.value)} className="h-8 w-36 text-xs" />
      </div>

      <Tabs defaultValue="journal">
        <TabsList className="h-9"><TabsTrigger value="journal" className="text-xs">{ar?'القيود اليومية':'Journal Entries'}</TabsTrigger><TabsTrigger value="trial" className="text-xs">{ar?'ميزان المراجعة':'Trial Balance'}</TabsTrigger></TabsList>

        {/* Journal Entries */}
        <TabsContent value="journal" className="space-y-2 mt-4">
          <AsyncSection
            loading={jeLoading}
            empty={!entries?.length}
            loadingVariant="rows"
            loadingRows={4}
            emptyState={{
              icon: BookOpen,
              title: ar ? 'لا توجد قيود في هذه الفترة' : 'No journal entries in this period',
            }}
          >
          {entries?.map(je => (
            <Card key={je.id} className="border hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-4 px-4 py-3 cursor-pointer" onClick={()=>setExpandedJE(expandedJE===je.id?null:je.id)}>
                <div className="min-w-[90px]">
                  <p className="text-[11px] font-mono text-primary font-bold">{je.entry_number}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(je.entry_date),'dd MMM yyyy')}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{je.description}</p>
                </div>
                <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-full font-semibold flex-shrink-0', SOURCE_COLORS[je.source]||'bg-muted text-muted-foreground')}>
                  {je.source.replace('_',' ')}
                </Badge>
                {je.is_posted && <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0"/>}
              </div>
              {expandedJE === je.id && je.journal_lines && (
                <div className="border-t border-border/50 bg-muted/20">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b bg-muted/40">
                        <th className="text-left py-2 px-4 font-semibold">{ar?'الحساب':'Account'}</th>
                        <th className="text-right py-2 px-4 font-semibold">{ar?'مدين':'Debit'}</th>
                        <th className="text-right py-2 px-4 font-semibold">{ar?'دائن':'Credit'}</th>
                      </tr></thead>
                      <tbody>
                        {je.journal_lines.map(line => (
                          <tr key={line.id} className="border-b last:border-0">
                            <td className="py-2 px-4">
                              <span className="font-mono text-muted-foreground mr-2">{(line.account as any)?.code}</span>
                              {ar&&(line.account as any)?.name_ar ? (line.account as any).name_ar : (line.account as any)?.name}
                            </td>
                            <td className="py-2 px-4 text-right font-medium">{Number(line.debit)>0?`${Number(line.debit).toFixed(3)} ${currency}`:''}</td>
                            <td className="py-2 px-4 text-right font-medium">{Number(line.credit)>0?`${Number(line.credit).toFixed(3)} ${currency}`:''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          ))}
          </AsyncSection>
        </TabsContent>

        {/* Trial Balance */}
        <TabsContent value="trial" className="mt-4">
          <Card className="border">
            <CardHeader className="pb-2 border-b"><CardTitle className="text-sm">{ar?'ميزان المراجعة':'Trial Balance'} — {from} → {to}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <AsyncSection
                loading={tbLoading}
                empty={!trialBalance?.length}
                loadingVariant="table"
                loadingRows={6}
                emptyState={{
                  icon: BookOpen,
                  title: ar ? 'لا توجد بيانات' : 'No data for this period',
                }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b bg-muted/40">
                      <th className="text-left py-3 px-4 font-semibold">{ar?'الكود':'Code'}</th>
                      <th className="text-left py-3 px-4 font-semibold">{ar?'اسم الحساب':'Account Name'}</th>
                      <th className="text-right py-3 px-4 font-semibold">{ar?'مدين':'Debit'}</th>
                      <th className="text-right py-3 px-4 font-semibold">{ar?'دائن':'Credit'}</th>
                      <th className="text-right py-3 px-4 font-semibold">{ar?'الرصيد':'Balance'}</th>
                    </tr></thead>
                    <tbody>
                      {(trialBalance||[]).map((a,i) => (
                        <tr key={a.id} className={cn('border-b last:border-0 hover:bg-muted/20',i%2===0&&'bg-muted/5')}>
                          <td className="py-2.5 px-4 font-mono text-muted-foreground">{a.code}</td>
                          <td className="py-2.5 px-4 font-medium">{ar&&a.name_ar?a.name_ar:a.name}</td>
                          <td className="py-2.5 px-4 text-right">{a.totalDebit>0?`${a.totalDebit.toFixed(3)}`:''}</td>
                          <td className="py-2.5 px-4 text-right">{a.totalCredit>0?`${a.totalCredit.toFixed(3)}`:''}</td>
                          <td className={cn('py-2.5 px-4 text-right font-bold', a.balance<0?'text-red-500':'')}>{a.balance.toFixed(3)} {currency}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="border-t-2 bg-muted/40 font-bold">
                      <td className="py-3 px-4" colSpan={2}>{ar?'الإجمالي':'TOTAL'}</td>
                      <td className="py-3 px-4 text-right">{tbTotalDebit.toFixed(3)}</td>
                      <td className="py-3 px-4 text-right">{tbTotalCredit.toFixed(3)}</td>
                      <td className={cn('py-3 px-4 text-right', Math.abs(tbTotalDebit-tbTotalCredit)<0.01?'text-emerald-600':'text-red-500')}>
                        {Math.abs(tbTotalDebit-tbTotalCredit)<0.01?(ar?'✓ متوازن':'✓ Balanced'):(ar?'✗ غير متوازن':'✗ Unbalanced')}
                      </td>
                    </tr></tfoot>
                  </table>
                </div>
              </AsyncSection>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New JE Dialog */}
      <Dialog open={showJE} onOpenChange={setShowJE}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{ar?'قيد يومي جديد':'New Journal Entry'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">{ar?'التاريخ':'Date'}</Label><Input type="date" value={jeForm.entry_date} onChange={e=>setJeForm({...jeForm,entry_date:e.target.value})} className="h-9" /></div>
              <div className="space-y-1.5"><Label className="text-xs">{ar?'البيان':'Description'}</Label><Input value={jeForm.description} onChange={e=>setJeForm({...jeForm,description:e.target.value})} className="h-9" placeholder={ar?'وصف القيد':'Entry description'} /></div>
            </div>
            {/* Lines */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold">{ar?'بنود القيد':'Journal Lines'}</p>
                <Button size="sm" variant="outline" onClick={addLine} className="h-7 text-xs gap-1"><Plus className="h-3 w-3"/>{ar?'إضافة سطر':'Add Line'}</Button>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-muted-foreground px-1">
                  <div className="col-span-5">{ar?'الحساب':'Account'}</div>
                  <div className="col-span-3 text-right">{ar?'مدين':'Debit'}</div>
                  <div className="col-span-3 text-right">{ar?'دائن':'Credit'}</div>
                  <div className="col-span-1"/>
                </div>
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Select value={line.account_id} onValueChange={v=>updateLine(i,'account_id',v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={ar?'اختر حساباً':'Account'}/></SelectTrigger>
                        <SelectContent>{(accounts||[]).map(a=><SelectItem key={a.id} value={a.id}>{a.code} — {ar&&a.name_ar?a.name_ar:a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3"><Input type="number" step="0.001" value={line.debit} onChange={e=>updateLine(i,'debit',e.target.value)} className="h-8 text-xs text-right" placeholder="0.000" /></div>
                    <div className="col-span-3"><Input type="number" step="0.001" value={line.credit} onChange={e=>updateLine(i,'credit',e.target.value)} className="h-8 text-xs text-right" placeholder="0.000" /></div>
                    <div className="col-span-1 flex justify-center">
                      {lines.length > 2 && <button onClick={()=>removeLine(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5"/></button>}
                    </div>
                  </div>
                ))}
              </div>
              <div className={cn('flex items-center justify-between mt-3 p-2 rounded-lg text-xs font-semibold', balanced?'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20':'bg-red-50 text-red-700 dark:bg-red-900/20')}>
                <span>{ar?'إجمالي المدين':'Total Debit'}: {totalDebit.toFixed(3)}</span>
                <span>{ar?'إجمالي الدائن':'Total Credit'}: {totalCredit.toFixed(3)}</span>
                <span>{balanced?(ar?'✓ متوازن':'✓ Balanced'):(ar?'✗ غير متوازن':'✗ Unbalanced')}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={()=>setShowJE(false)}>{ar?'إلغاء':'Cancel'}</Button>
            <Button size="sm" onClick={handleSubmitJE} disabled={!balanced||!jeForm.description||createJE.isPending}>
              {createJE.isPending?(ar?'جارٍ الترحيل...':'Posting...'):(ar?'ترحيل القيد':'Post Entry')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
