import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, Users, Star, Crown, Phone, Mail, Calendar, Download } from 'lucide-react';
import { useClients, ClientTier } from '@/hooks/useClients';
import AddClientDialog from '@/components/clients/AddClientDialog';
import ClientDetailSheet from '@/components/clients/ClientDetailSheet';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { useLanguage } from '@/contexts/LanguageContext';
import { exportCSV } from '@/lib/exportUtils';

const TIER_CONFIG: Record<ClientTier, { label: string; labelAr: string; cls: string; icon: React.ReactNode }> = {
  normal: { label: 'Client',  labelAr: 'عميلة',  cls: 'bg-muted text-muted-foreground border-border',                                icon: null },
  vip:    { label: 'VIP',     labelAr: 'VIP',    cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700', icon: <Star className="h-2.5 w-2.5" /> },
  vvip:   { label: 'VVIP',    labelAr: 'VVIP',   cls: 'bg-primary/8 text-primary border-primary/25',                               icon: <Crown className="h-2.5 w-2.5" /> },
};

const AVATAR_COLORS = [
  'bg-rose-100 text-rose-700',    'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',      'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',  'bg-pink-100 text-pink-700',
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function ClientCard({ client, onClick }: { client: any; onClick: () => void }) {
  const tier = TIER_CONFIG[client.tier as ClientTier] || TIER_CONFIG.normal;
  const initials = client.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <Card
      onClick={onClick}
      className="card-hover cursor-pointer border hover:border-primary/30 transition-all duration-150 group"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0', avatarColor(client.name))}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{client.name}</p>
              {client.tier !== 'normal' && (
                <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 h-4 gap-0.5 font-bold rounded-full', tier.cls)}>
                  {tier.icon}{tier.label}
                </Badge>
              )}
            </div>
            <div className="space-y-0.5">
              {client.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-2.5 w-2.5" />{client.phone}
                </p>
              )}
              {client.email && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <Mail className="h-2.5 w-2.5" />{client.email}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5" />
            {format(new Date(client.created_at), 'MMM d, yyyy')}
          </p>
          <div className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', tier.cls)}>
            {tier.label}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const Clients = () => {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [searchInput, setSearchInput] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const debouncedSearch = useDebounce(searchInput, 300);
  const { data: clients, isLoading } = useClients(debouncedSearch);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (tierFilter === 'all') return clients;
    return clients.filter(c => c.tier === tierFilter);
  }, [clients, tierFilter]);

  const stats = useMemo(() => {
    if (!clients) return { total: 0, vip: 0, vvip: 0 };
    return {
      total: clients.length,
      vip:   clients.filter(c => c.tier === 'vip').length,
      vvip:  clients.filter(c => c.tier === 'vvip').length,
    };
  }, [clients]);

  const filters = [
    { key: 'all',    label: ar ? 'الكل' : 'All',   count: stats.total },
    { key: 'vip',    label: 'VIP',                  count: stats.vip },
    { key: 'vvip',   label: 'VVIP',                 count: stats.vvip },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">
            {ar ? 'إدارة العميلات' : 'Client Management'}
          </p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            {ar ? 'العميلات' : 'Clients'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total} {ar ? 'عميلة مسجلة' : 'clients registered'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-9"
            onClick={() => exportCSV(
              (clients || []).map((c: any) => ({ name: c.name, phone: c.phone, email: c.email || '', tier: c.tier, created: format(new Date(c.created_at), 'yyyy-MM-dd') })),
              'clients',
              { name: 'Name', phone: 'Phone', email: 'Email', tier: 'Tier', created: 'Member Since' }
            )}>
            <Download className="h-3.5 w-3.5" />{ar ? 'CSV' : 'CSV'}
          </Button>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)} className="gap-1.5 shadow-sm">
            <Plus className="h-3.5 w-3.5" />
            {ar ? 'إضافة عميلة' : 'Add Client'}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: ar ? 'إجمالي العميلات' : 'Total Clients', val: stats.total, icon: Users,  color: 'text-primary' },
          { label: 'VIP',                                      val: stats.vip,   icon: Star,   color: 'text-amber-500' },
          { label: 'VVIP',                                     val: stats.vvip,  icon: Crown,  color: 'text-primary' },
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

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={ar ? 'بحث بالاسم أو الهاتف...' : 'Search by name, phone, email...'}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1.5">
          {filters.map(f => (
            <Button
              key={f.key}
              variant={tierFilter === f.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTierFilter(f.key)}
              className="h-9 gap-1.5"
            >
              {f.label}
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                tierFilter === f.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>
                {f.count}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_,i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : filteredClients.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredClients.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              onClick={() => { setSelectedClientId(client.id); setIsDetailOpen(true); }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-semibold text-muted-foreground">
            {ar ? 'لا توجد عميلات' : 'No clients found'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {ar ? 'جربي البحث بكلمة مختلفة' : 'Try a different search term'}
          </p>
        </div>
      )}

      <AddClientDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
      <ClientDetailSheet clientId={selectedClientId} open={isDetailOpen} onOpenChange={setIsDetailOpen} />
    </div>
  );
};

export default Clients;
