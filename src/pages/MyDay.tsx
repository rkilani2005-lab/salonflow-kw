import { useEffect, useState, useMemo } from "react";
import { supabase as _supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, DollarSign, Sparkles, ShoppingBag, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface Booking {
  id: string; start_time: string; status: string;
  client: { name: string } | null;
  service: { name: string; duration: number } | null;
}

interface Metric { label: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string }>; tone: string; }

const MyDay = () => {
  const { tenant, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string>("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [todayCommission, setTodayCommission] = useState(0);
  const [todayTips, setTodayTips] = useState(0);
  const [weekCommission, setWeekCommission] = useState(0);
  const [retailAttachRate, setRetailAttachRate] = useState<number | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (!tenant?.id || !user?.id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id, user?.id]);

  async function load() {
    setLoading(true);
    try {
      const { data: staffRow } = await supabase.from("staff").select("id, name")
        .eq("tenant_id", tenant!.id).eq("user_id", user!.id).maybeSingle();
      if (!staffRow) { setLoading(false); return; }
      setStaffId(staffRow.id);
      setStaffName(staffRow.name);

      const { data: bks } = await supabase.from("bookings")
        .select(`id, start_time, status, client:clients(name), service:services(name, duration)`)
        .eq("tenant_id", tenant!.id).eq("staff_id", staffRow.id).eq("booking_date", today).order("start_time");
      setBookings((bks || []) as Booking[]);

      const dayStart = `${today}T00:00:00.000Z`;
      const dayEnd   = `${today}T23:59:59.999Z`;
      const { data: ce } = await supabase.from("staff_commission_earnings")
        .select("commission_amount").eq("staff_id", staffRow.id).gte("created_at", dayStart).lte("created_at", dayEnd);
      setTodayCommission((ce || []).reduce((s: number, r: any) => s + Number(r.commission_amount || 0), 0));

      const { data: tipRows } = await supabase.from("transaction_tips")
        .select("amount, transaction_id, transactions!inner(created_at, staff_id)")
        .eq("staff_id", staffRow.id).gte("transactions.created_at", dayStart).lte("transactions.created_at", dayEnd);
      setTodayTips((tipRows || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0));

      const weekStart = new Date(Date.now() - 6 * 86400_000).toISOString();
      const { data: weekEarn } = await supabase.from("staff_commission_earnings")
        .select("commission_amount").eq("staff_id", staffRow.id).gte("created_at", weekStart);
      setWeekCommission((weekEarn || []).reduce((s: number, r: any) => s + Number(r.commission_amount || 0), 0));

      const monthStart = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data: myTxns } = await supabase.from("staff_commission_earnings")
        .select("transaction_id").eq("staff_id", staffRow.id).gte("created_at", monthStart);
      const txnIds = Array.from(new Set((myTxns || []).map((r: any) => r.transaction_id)));
      if (txnIds.length > 0) {
        const { data: items } = await supabase.from("transaction_items")
          .select("transaction_id, item_type").in("transaction_id", txnIds);
        const withRetail = new Set((items || []).filter((i: any) => i.item_type === "product").map((i: any) => i.transaction_id));
        setRetailAttachRate(Math.round((withRetail.size / txnIds.length) * 100));
      } else { setRetailAttachRate(null); }
    } finally { setLoading(false); }
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-9 w-48" />
      <div className="grid gap-3 md:grid-cols-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div>
    </div>
  );

  if (!staffId) return (
    <div className="p-6">
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">Your account isn't linked to a staff profile yet.</p>
        <p className="text-sm mt-1">Ask the owner to link you in Team Users.</p>
      </CardContent></Card>
    </div>
  );

  const currency = (tenant as any)?.currency || "KWD";
  const metrics: Metric[] = [
    { label: "Today bookings", value: String(bookings.length), hint: `${bookings.filter(b => b.status === "completed").length} done`, icon: Calendar, tone: "text-blue-600" },
    { label: "Today commission", value: `${todayCommission.toFixed(3)} ${currency}`, icon: DollarSign, tone: "text-emerald-600" },
    { label: "Today tips", value: `${todayTips.toFixed(3)} ${currency}`, icon: Sparkles, tone: "text-amber-600" },
    { label: "This week", value: `${weekCommission.toFixed(3)} ${currency}`, icon: TrendingUp, tone: "text-violet-600" },
  ];

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">My Day</h1>
        <p className="text-sm text-muted-foreground">Welcome back, {staffName} — {format(new Date(), "EEEE, MMM d")}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {metrics.map(m => { const Icon = m.icon; return (
          <Card key={m.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{m.label}</p>
                  <p className="text-xl font-bold mt-1">{m.value}</p>
                  {m.hint && <p className="text-xs text-muted-foreground mt-0.5">{m.hint}</p>}
                </div>
                <Icon className={`h-5 w-5 ${m.tone}`} />
              </div>
            </CardContent>
          </Card>
        ); })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Today's schedule</CardTitle></CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No appointments today.</p>
            ) : (
              <div className="divide-y">
                {bookings.map(b => (
                  <div key={b.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{b.client?.name ?? "Walk-in"}</p>
                      <p className="text-xs text-muted-foreground">{b.service?.name} · {b.service?.duration} min</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono">{b.start_time?.slice(0, 5)}</p>
                      <Badge variant="outline" className="text-[10px] mt-0.5">{b.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Retail attach</CardTitle></CardHeader>
          <CardContent className="text-center py-6">
            {retailAttachRate === null ? (
              <p className="text-sm text-muted-foreground">Not enough data yet.</p>
            ) : (
              <>
                <p className="text-4xl font-bold">{retailAttachRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">of your services included retail (30d)</p>
                <ShoppingBag className="h-6 w-6 mx-auto mt-3 text-amber-500" />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MyDay;
