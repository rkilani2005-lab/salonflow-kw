import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Phone, Mail, Calendar, DollarSign, Star, Clock, Edit2, Save, X,
  CheckCircle2, XCircle, AlertCircle, Crown, Gift, TrendingUp, Scissors,
  GitMerge,
} from 'lucide-react';
import { useClientWithStats, useUpdateClient, ClientTier } from '@/hooks/useClients';
import { useClientLoyalty } from '@/hooks/useLoyalty';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import MergeClientDialog from './MergeClientDialog';

const tierColors: Record<ClientTier, string> = {
  normal: 'bg-muted text-muted-foreground',
  vip:    'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  vvip:   'bg-primary/10 text-primary',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed:  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500"/>,
  cancelled:  <XCircle className="h-3.5 w-3.5 text-red-400"/>,
  no_show:    <XCircle className="h-3.5 w-3.5 text-red-400"/>,
  confirmed:  <AlertCircle className="h-3.5 w-3.5 text-blue-400"/>,
  in_service: <AlertCircle className="h-3.5 w-3.5 text-violet-400"/>,
};

function useClientTransactions(clientId: string | null) {
  return useQuery({
    queryKey: ['client-transactions', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('id, grand_total, tip_amount, discount_amount, created_at, status')
        .eq('client_id', clientId!)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!clientId,
  });
}

interface Props {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ClientDetailSheet({ clientId, open, onOpenChange }: Props) {
  const { data: client, isLoading } = useClientWithStats(clientId);
  const { data: loyaltyTxns = [] }  = useClientLoyalty(clientId);
  const { data: transactions = [] }  = useClientTransactions(clientId);
  const updateClient = useUpdateClient();
  const [isEditing, setIsEditing] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [editData, setEditData] = useState<{
    name: string; phone: string; email: string; notes: string; tier: ClientTier;
  } | null>(null);

  const startEditing = () => {
    if (client) {
      setEditData({ name: client.name, phone: client.phone, email: client.email||'', notes: client.notes||'', tier: client.tier as ClientTier });
      setIsEditing(true);
    }
  };
  const cancelEditing = () => { setIsEditing(false); setEditData(null); };
  const saveChanges = async () => {
    if (!client || !editData) return;
    await updateClient.mutateAsync({ id: client.id, ...editData, email: editData.email||null, notes: editData.notes||null });
    setIsEditing(false); setEditData(null);
  };

  const loyaltyBalance = loyaltyTxns.length > 0 ? (loyaltyTxns[0] as any).balance_after : (client as any)?.loyalty_points || 0;
  const totalTips = transactions.reduce((s: number, t: any) => s + Number(t.tip_amount), 0);
  const avgTicket = transactions.length > 0
    ? (transactions.reduce((s: number, t: any) => s + Number(t.grand_total), 0) / transactions.length)
    : 0;

  if (isLoading || !client) return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><Skeleton className="h-6 w-48"/><Skeleton className="h-4 w-32"/></SheetHeader>
        <div className="space-y-4 mt-6"><Skeleton className="h-24 w-full"/><Skeleton className="h-48 w-full"/></div>
      </SheetContent>
    </Sheet>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {/* Header */}
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{client.name}</SheetTitle>
              <SheetDescription>Client since {format(new Date(client.created_at),'MMM yyyy')}</SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              {client.tier === 'vvip' && <Crown className="h-4 w-4 text-amber-500"/>}
              <Badge className={cn('uppercase text-xs', tierColors[client.tier as ClientTier])}>{client.tier}</Badge>
            </div>
          </div>
        </SheetHeader>

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { icon: Calendar,   val: client.total_visits,                            label: 'Visits' },
            { icon: DollarSign, val: Number(client.total_spent).toFixed(2),          label: 'KWD Spent' },
            { icon: TrendingUp, val: avgTicket.toFixed(2),                           label: 'Avg Ticket' },
            { icon: Star,       val: loyaltyBalance,                                 label: 'Points', color: 'text-amber-500' },
          ].map(({ icon: Icon, val, label, color }) => (
            <Card key={label}><CardContent className="p-2.5 text-center">
              <Icon className={cn('h-3.5 w-3.5 mx-auto text-muted-foreground mb-1', color)}/>
              <p className="text-base font-black stat-number leading-none">{val}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full h-8">
            <TabsTrigger value="details"  className="flex-1 text-xs">Details</TabsTrigger>
            <TabsTrigger value="history"  className="flex-1 text-xs">Visits</TabsTrigger>
            <TabsTrigger value="loyalty"  className="flex-1 text-xs">Loyalty</TabsTrigger>
          </TabsList>

          {/* ── Details tab ── */}
          <TabsContent value="details" className="space-y-4 mt-3">
            <div className="flex justify-end gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={cancelEditing}><X className="h-3.5 w-3.5 mr-1"/>Cancel</Button>
                  <Button size="sm" onClick={saveChanges} disabled={updateClient.isPending}><Save className="h-3.5 w-3.5 mr-1"/>Save</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setMergeOpen(true)}><GitMerge className="h-3.5 w-3.5 mr-1"/>Merge duplicate</Button>
                  <Button variant="outline" size="sm" onClick={startEditing}><Edit2 className="h-3.5 w-3.5 mr-1"/>Edit</Button>
                </>
              )}
            </div>

            {isEditing && editData ? (
              <div className="space-y-3">
                {[
                  { label: 'Name',  key: 'name',  type: 'text'  },
                  { label: 'Phone', key: 'phone', type: 'text'  },
                  { label: 'Email', key: 'email', type: 'email' },
                ].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs font-semibold">{f.label}</Label>
                    <Input type={f.type} value={(editData as any)[f.key]}
                      onChange={e => setEditData({...editData, [f.key]: e.target.value})} className="h-9"/>
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tier</Label>
                  <Select value={editData.tier} onValueChange={v => setEditData({...editData, tier: v as ClientTier})}>
                    <SelectTrigger className="h-9"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="vip">⭐ VIP</SelectItem>
                      <SelectItem value="vvip">👑 VVIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Notes</Label>
                  <Textarea value={editData.notes} onChange={e => setEditData({...editData, notes: e.target.value})} rows={3} className="resize-none text-sm"/>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0"/><span>{client.phone}</span>
                </div>
                {client.email && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0"/><span>{client.email}</span>
                  </div>
                )}
                {client.last_visit && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0"/>
                    <span>Last visit: {format(new Date(client.last_visit),'MMM d, yyyy')}</span>
                  </div>
                )}
                {client.notes && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground italic">{client.notes}</div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Visit history tab ── */}
          <TabsContent value="history" className="mt-3">
            {(client as any).bookings?.length > 0 ? (
              <div className="space-y-2">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-3 rounded-md bg-muted/40 text-center">
                    <p className="text-base font-black stat-number text-emerald-600">{Number(client.total_spent).toFixed(3)}</p>
                    <p className="text-[10px] text-muted-foreground">Total Spent (KWD)</p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/40 text-center">
                    <p className="text-base font-black stat-number text-amber-600">{totalTips.toFixed(3)}</p>
                    <p className="text-[10px] text-muted-foreground">Total Tips (KWD)</p>
                  </div>
                </div>

                {/* Timeline */}
                <div className="relative border-l-2 border-border ml-2 space-y-0">
                  {(client as any).bookings.map((b: any, i: number) => (
                    <div key={b.id} className="relative pl-5 pb-4">
                      {/* Dot */}
                      <div className={cn('absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-background flex items-center justify-center',
                        b.status === 'completed' ? 'bg-emerald-500' :
                        b.status === 'cancelled' || b.status === 'no_show' ? 'bg-red-400' : 'bg-blue-400')}>
                        <Scissors className="h-2 w-2 text-white"/>
                      </div>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{b.service_name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {format(new Date(b.booking_date),'MMM d, yyyy')}
                            {b.start_time ? ` · ${b.start_time.slice(0,5)}` : ''}
                            {b.staff_name ? ` · ${b.staff_name}` : ''}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="flex items-center gap-1 justify-end mb-0.5">
                            {STATUS_ICON[b.status]}
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 rounded-sm capitalize">{b.status}</Badge>
                          </div>
                          {b.status === 'completed' && (
                            <p className="text-xs font-bold stat-number">{Number(b.price).toFixed(3)} KWD</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30"/>
                <p className="text-sm">No visit history yet</p>
              </div>
            )}
          </TabsContent>

          {/* ── Loyalty tab ── */}
          <TabsContent value="loyalty" className="mt-3">
            <div className="space-y-3">
              {/* Balance card */}
              <div className="p-4 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">Points Balance</p>
                    <p className="text-3xl font-black stat-number text-amber-700 dark:text-amber-300">{loyaltyBalance}</p>
                    <p className="text-xs text-amber-600/70 mt-1">pts</p>
                  </div>
                  <Star className="h-10 w-10 text-amber-400 opacity-40"/>
                </div>
              </div>

              {/* History */}
              {loyaltyTxns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Gift className="h-7 w-7 mx-auto mb-2 opacity-30"/>
                  <p className="text-sm">No loyalty activity yet</p>
                  <p className="text-xs mt-1 opacity-60">Points are earned automatically at checkout</p>
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden divide-y divide-border">
                  {loyaltyTxns.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-xs font-medium capitalize">{t.type}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                          {t.note ? ` · ${t.note}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-sm font-black stat-number', t.points > 0 ? 'text-emerald-600' : 'text-red-500')}>
                          {t.points > 0 ? '+' : ''}{t.points}
                        </p>
                        <p className="text-[10px] text-muted-foreground">bal: {t.balance_after}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
      {client && (
        <MergeClientDialog
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          primary={{ id: client.id, name: client.name, phone: client.phone, email: client.email }}
        />
      )}
    </Sheet>
  );
}
