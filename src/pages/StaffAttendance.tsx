import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStaff } from '@/hooks/useStaff';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as _supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Clock, Calendar, Users, TrendingUp, CheckCircle2, XCircle,
  AlertCircle, Edit2, Download, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isToday, isSameDay, parseISO, addMonths, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'day_off';

interface AttendanceRecord {
  id: string;
  staff_id: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  status: AttendanceStatus;
  notes: string | null;
}

const STATUS_CFG: Record<AttendanceStatus, { label: string; color: string; bg: string }> = {
  present:  { label: 'Present',  color: 'text-emerald-700', bg: 'bg-emerald-500' },
  absent:   { label: 'Absent',   color: 'text-red-600',     bg: 'bg-red-500'     },
  late:     { label: 'Late',     color: 'text-amber-700',   bg: 'bg-amber-400'   },
  half_day: { label: 'Half Day', color: 'text-blue-700',    bg: 'bg-blue-400'    },
  day_off:  { label: 'Day Off',  color: 'text-muted-foreground', bg: 'bg-muted'  },
};

function useAttendance(tenantId: string | undefined, year: number, month: number) {
  return useQuery({
    queryKey: ['attendance', tenantId, year, month],
    queryFn: async () => {
      const from = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
      const to   = format(new Date(year, month, 0),     'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('id, staff_id, tenant_id, check_in, check_out, date, notes, late_minutes, early_leave_minutes')
        .eq('tenant_id', tenantId!)
        .gte('work_date', from)
        .lte('work_date', to);
      if (error) throw error;
      return (data || []) as AttendanceRecord[];
    },
    enabled: !!tenantId,
  });
}

function useUpsertAttendance() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (record: Partial<AttendanceRecord> & { staff_id: string; work_date: string }) => {
      const { error } = await supabase.from('staff_attendance').upsert({
        ...record,
        tenant_id: tenant!.id,
      }, { onConflict: 'staff_id,work_date' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      toast({ title: '✅ Attendance saved' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export default function StaffAttendance() {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';

  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<{ staffId: string; date: string; existing?: AttendanceRecord } | null>(null);

  const year  = viewMonth.getFullYear();
  const month = viewMonth.getMonth() + 1;

  const { data: staffList = [], isLoading: staffLoading } = useStaff();
  const { data: records  = [], isLoading: recLoading }   = useAttendance(tenant?.id, year, month);
  const upsert = useUpsertAttendance();

  // Edit form state
  const [editStatus,      setEditStatus]      = useState<AttendanceStatus>('present');
  const [editClockIn,     setEditClockIn]     = useState('');
  const [editClockOut,    setEditClockOut]    = useState('');
  const [editBreak,       setEditBreak]       = useState('0');
  const [editNotes,       setEditNotes]       = useState('');

  const openEdit = (staffId: string, date: string) => {
    const existing = records.find(r => r.staff_id === staffId && r.work_date === date);
    setEditRecord({ staffId, date, existing });
    setEditStatus(existing?.status || 'present');
    setEditClockIn(existing?.clock_in ? existing.clock_in.slice(11, 16) : '09:00');
    setEditClockOut(existing?.clock_out ? existing.clock_out.slice(11, 16) : '18:00');
    setEditBreak(String(existing?.break_minutes || 0));
    setEditNotes(existing?.notes || '');
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editRecord) return;
    await upsert.mutateAsync({
      staff_id:      editRecord.staffId,
      work_date:     editRecord.date,
      status:        editStatus,
      clock_in:      editStatus === 'present' || editStatus === 'late' || editStatus === 'half_day'
                       ? `${editRecord.date}T${editClockIn}:00` : null,
      clock_out:     editStatus === 'present' || editStatus === 'late' || editStatus === 'half_day'
                       ? `${editRecord.date}T${editClockOut}:00` : null,
      break_minutes: Number(editBreak),
      notes:         editNotes || null,
    });
    setEditOpen(false);
  };

  // Calculate hours worked
  const hoursWorked = (r?: AttendanceRecord) => {
    if (!r?.clock_in || !r?.clock_out) return 0;
    const diff = (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 3600000;
    return Math.max(0, Math.round((diff - (r.break_minutes / 60)) * 10) / 10);
  };

  // Monthly summary per staff
  const summary = useMemo(() => {
    return staffList.map(staff => {
      const sr = records.filter(r => r.staff_id === staff.id);
      const present  = sr.filter(r => ['present','late','half_day'].includes(r.status)).length;
      const absent   = sr.filter(r => r.status === 'absent').length;
      const late     = sr.filter(r => r.status === 'late').length;
      const totalHrs = sr.reduce((s, r) => s + hoursWorked(r), 0);
      return { ...staff, present, absent, late, totalHrs };
    });
  }, [staffList, records]);

  // Days in month
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(viewMonth),
    end:   endOfMonth(viewMonth),
  });

  // Displayed staff
  const displayStaff = selectedStaff === 'all' ? staffList : staffList.filter(s => s.id === selectedStaff);

  const isLoading = staffLoading || recLoading;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1 select-none">
            {ar ? 'الفريق' : 'Staff'}
          </p>
          <h1 className="text-3xl font-black leading-none" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', letterSpacing: '-0.04em' }}>
            {ar ? 'سجل الحضور' : 'Attendance'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {ar ? 'تتبع الحضور وساعات العمل وتقارير الرواتب' : 'Track attendance, working hours and payroll summaries'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => setViewMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4"/>
          </Button>
          <span className="text-sm font-semibold w-32 text-center">{format(viewMonth, 'MMMM yyyy')}</span>
          <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => setViewMonth(m => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4"/>
          </Button>
        </div>
      </div>

      {/* Staff filter */}
      <div className="flex items-center gap-3">
        <Select value={selectedStaff} onValueChange={setSelectedStaff}>
          <SelectTrigger className="h-9 w-48 text-sm">
            <SelectValue placeholder="All staff"/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar ? 'كل الموظفات' : 'All Staff'}</SelectItem>
            {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="gap-1.5 h-9 ml-auto"
          onClick={() => {
            const { exportCSV } = require('@/lib/exportUtils');
            const rows = summary.map(s => ({
              name: s.name, present: s.present, absent: s.absent,
              late: s.late, hours: s.totalHrs.toFixed(1),
            }));
            exportCSV(rows, `attendance_${format(viewMonth,'yyyy-MM')}`, {
              name: 'Staff', present: 'Present', absent: 'Absent', late: 'Late', hours: 'Hours',
            });
          }}>
          <Download className="h-3.5 w-3.5"/>CSV
        </Button>
      </div>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_,i) => <Skeleton key={i} className="h-20 rounded-md"/>)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: ar ? 'إجمالي الأيام' : 'Total Days',      val: daysInMonth.length,                                    icon: Calendar,     color: 'text-primary' },
            { label: ar ? 'أيام الحضور' : 'Present Days',      val: records.filter(r => r.status==='present').length,      icon: CheckCircle2, color: 'text-emerald-600' },
            { label: ar ? 'أيام الغياب' : 'Absences',          val: records.filter(r => r.status==='absent').length,       icon: XCircle,      color: 'text-red-500' },
            { label: ar ? 'إجمالي الساعات' : 'Total Hours',    val: records.reduce((s,r)=>s+hoursWorked(r),0).toFixed(1), icon: Clock,        color: 'text-amber-600' },
          ].map(({ label, val, icon: Icon, color }) => (
            <Card key={label} className="border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <Icon className={cn('h-4 w-4', color)}/>
                </div>
                <p className={cn('stat-number text-xl font-black', color)}>{val}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Monthly summary table */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-[0.07em] text-muted-foreground/60 mb-3 select-none">
          {ar ? 'ملخص الشهر' : 'Monthly Summary'}
        </h2>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left py-2.5 px-4 font-semibold">{ar ? 'الموظفة' : 'Staff'}</th>
                <th className="text-center py-2.5 px-3 font-semibold text-emerald-600">{ar ? 'حضور' : 'Present'}</th>
                <th className="text-center py-2.5 px-3 font-semibold text-red-500">{ar ? 'غياب' : 'Absent'}</th>
                <th className="text-center py-2.5 px-3 font-semibold text-amber-600">{ar ? 'تأخر' : 'Late'}</th>
                <th className="text-center py-2.5 px-3 font-semibold">{ar ? 'الساعات' : 'Hours'}</th>
              </tr>
            </thead>
            <tbody>
              {summary.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 font-medium">{s.name}</td>
                  <td className="py-3 px-3 text-center"><Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] h-5 px-2">{s.present}</Badge></td>
                  <td className="py-3 px-3 text-center"><Badge className="bg-red-100 text-red-700 border-0 text-[10px] h-5 px-2">{s.absent}</Badge></td>
                  <td className="py-3 px-3 text-center"><Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] h-5 px-2">{s.late}</Badge></td>
                  <td className="py-3 px-3 text-center font-bold stat-number">{s.totalHrs.toFixed(1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calendar grid per staff member */}
      {displayStaff.map(staff => {
        const staffRecords = records.filter(r => r.staff_id === staff.id);
        const getRecord = (date: Date) =>
          staffRecords.find(r => r.work_date === format(date, 'yyyy-MM-dd'));

        return (
          <div key={staff.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-sm bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                  {staff.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                </div>
                <h3 className="text-sm font-semibold">{staff.name}</h3>
              </div>
            </div>
            <div className="border rounded-md overflow-hidden">
              {/* Day header */}
              <div className="grid grid-cols-7 border-b bg-muted/40">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="py-2 text-center text-[10px] font-semibold text-muted-foreground">{d}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {/* Empty cells before first day */}
                {Array.from({ length: getDay(daysInMonth[0]) }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-14 border-r border-b border-border/30"/>
                ))}
                {daysInMonth.map(day => {
                  const rec = getRecord(day);
                  const cfg = rec ? STATUS_CFG[rec.status] : null;
                  const todayClass = isToday(day) ? 'ring-1 ring-primary ring-inset' : '';
                  const hrs = rec ? hoursWorked(rec) : 0;

                  return (
                    <button
                      key={day.toISOString()}
                      className={cn(
                        'h-14 border-r border-b border-border/30 p-1.5 text-left transition-colors hover:bg-primary/5 relative group',
                        todayClass,
                        rec?.status === 'absent' ? 'bg-red-50/30 dark:bg-red-950/10' : '',
                        rec?.status === 'present' ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : '',
                      )}
                      onClick={() => openEdit(staff.id, format(day, 'yyyy-MM-dd'))}
                    >
                      <span className={cn('text-[11px] font-bold', isToday(day) ? 'text-primary' : 'text-muted-foreground')}>
                        {format(day, 'd')}
                      </span>
                      {rec && (
                        <div className="mt-0.5 space-y-0.5">
                          <div className={cn('text-[9px] font-bold', cfg?.color)}>{cfg?.label}</div>
                          {hrs > 0 && <div className="text-[9px] text-muted-foreground">{hrs}h</div>}
                        </div>
                      )}
                      {!rec && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit2 className="h-3 w-3 text-muted-foreground"/>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary"/>
              {editRecord ? format(parseISO(editRecord.date), 'EEEE, MMM d yyyy') : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'الحالة *' : 'Status *'}</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(STATUS_CFG).map(([status, cfg]) => (
                  <button key={status} onClick={() => setEditStatus(status as AttendanceStatus)}
                    className={cn('text-xs py-1.5 px-2 rounded-md border font-medium transition-all',
                      editStatus === status ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40')}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {['present','late','half_day'].includes(editStatus) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{ar ? 'وقت الدخول' : 'Clock In'}</Label>
                  <Input type="time" value={editClockIn} onChange={e => setEditClockIn(e.target.value)} className="h-9"/>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{ar ? 'وقت الخروج' : 'Clock Out'}</Label>
                  <Input type="time" value={editClockOut} onChange={e => setEditClockOut(e.target.value)} className="h-9"/>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{ar ? 'استراحة (دقيقة)' : 'Break (min)'}</Label>
                  <Input type="number" min="0" value={editBreak} onChange={e => setEditBreak(e.target.value)} className="h-9"/>
                </div>
                <div className="flex items-end pb-1">
                  <p className="text-sm text-muted-foreground">
                    {ar ? 'الساعات:' : 'Hours:'} <strong className="stat-number text-foreground">
                      {editClockIn && editClockOut ? Math.max(0, (
                        (new Date(`2000-01-01T${editClockOut}`).getTime() - new Date(`2000-01-01T${editClockIn}`).getTime()) / 3600000
                        - Number(editBreak) / 60
                      )).toFixed(1) : '0'}h
                    </strong>
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? 'ملاحظات' : 'Notes'}</Label>
              <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} className="text-sm resize-none" placeholder={ar ? 'اختياري' : 'Optional'}/>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={upsert.isPending} className="gap-1.5 min-w-[100px]">
              {upsert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <CheckCircle2 className="h-3.5 w-3.5"/>}
              {ar ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
