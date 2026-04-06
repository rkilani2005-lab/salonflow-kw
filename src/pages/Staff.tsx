import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, Users, Clock, UserCheck, Phone, Mail, Scissors, Download } from 'lucide-react';
import { useStaff } from '@/hooks/useStaff';
import AddStaffDialog from '@/components/staff/AddStaffDialog';
import StaffDetailSheet from '@/components/staff/StaffDetailSheet';
import { exportCSV } from '@/lib/exportUtils';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { useLanguage } from '@/contexts/LanguageContext';

const PALETTE = [
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
];

function staffColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function StaffCard({ member, onClick }: { member: any; onClick: () => void }) {
  const initials = member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const color = member.color || null;

  return (
    <Card
      onClick={onClick}
      className="card-hover cursor-pointer border hover:border-primary/30 transition-all duration-150 group overflow-hidden"
    >
      {/* Color strip */}
      <div className="h-1.5 w-full" style={{ background: color || 'hsl(var(--primary)/0.5)' }} />
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div
            className={cn('h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0', staffColor(member.name))}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{member.name}</p>
            </div>
            {member.name_ar && (
              <p className="text-xs text-muted-foreground" dir="rtl">{member.name_ar}</p>
            )}
            <Badge
              variant="outline"
              className={cn('text-[9px] px-1.5 py-0 h-4 mt-1 font-semibold rounded-full',
                member.is_active
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {member.is_active ? '● Active' : '○ Inactive'}
            </Badge>
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          {member.phone && (
            <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{member.phone}</p>
          )}
          {member.email && (
            <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" />{member.email}</p>
          )}
          <p className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {member.working_hours_start?.slice(0,5)} — {member.working_hours_end?.slice(0,5)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const Staff = () => {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [searchInput, setSearchInput] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const debouncedSearch = useDebounce(searchInput, 300);
  const { data: staff, isLoading } = useStaff(debouncedSearch);

  const stats = useMemo(() => {
    if (!staff) return { total: 0, active: 0 };
    return { total: staff.length, active: staff.filter(s => s.is_active).length };
  }, [staff]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">
            {ar ? 'إدارة الفريق' : 'Team Management'}
          </p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            {ar ? 'الموظفات' : 'Staff'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.active} {ar ? 'نشطة من' : 'active of'} {stats.total}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-9"
            onClick={() => exportCSV(
              (staff || []).map((s: any) => ({ name: s.name, name_ar: s.name_ar || '', phone: s.phone || '', email: s.email || '', status: s.is_active ? 'Active' : 'Inactive', hours: `${s.working_hours_start}–${s.working_hours_end}` })),
              'staff',
              { name: 'Name', name_ar: 'Arabic Name', phone: 'Phone', email: 'Email', status: 'Status', hours: 'Working Hours' }
            )}>
            <Download className="h-3.5 w-3.5" />CSV
          </Button>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)} className="gap-1.5 shadow-sm">
            <Plus className="h-3.5 w-3.5" />
            {ar ? 'إضافة موظفة' : 'Add Staff'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: ar ? 'إجمالي الموظفات' : 'Total Staff', val: stats.total,  icon: Users,     color: 'text-primary' },
          { label: ar ? 'نشطة' : 'Active Now',              val: stats.active, icon: UserCheck,  color: 'text-emerald-500' },
        ].map(({ label, val, icon: Icon, color }) => (
          <Card key={label} className="border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <div>
                <p className="text-xl font-bold stat-number">{val}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={ar ? 'بحث عن موظفة...' : 'Search staff...'}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_,i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : staff && staff.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {staff.map(member => (
            <StaffCard
              key={member.id}
              member={member}
              onClick={() => { setSelectedStaffId(member.id); setIsDetailOpen(true); }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Scissors className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-semibold text-muted-foreground">
            {ar ? 'لا توجد موظفات' : 'No staff found'}
          </p>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)} className="mt-3">
            {ar ? 'إضافة أول موظفة' : 'Add your first staff member'}
          </Button>
        </div>
      )}

      <AddStaffDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
      <StaffDetailSheet staffId={selectedStaffId} open={isDetailOpen} onOpenChange={setIsDetailOpen} />
    </div>
  );
};

export default Staff;
