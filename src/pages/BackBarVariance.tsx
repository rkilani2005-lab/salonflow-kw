import { useEffect, useMemo, useState } from "react";
import { supabase as _supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

interface VarianceRow {
  id: string; service_name: string; product_name: string;
  unit_of_measure: string | null; staff_name: string | null;
  expected_qty: number | null; actual_qty: number;
  variance_pct: number | null; recorded_at: string;
}

const RANGES = [
  { value: "7",  label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const BackBarVariance = () => {
  const { tenant } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<VarianceRow[]>([]);
  const [days, setDays] = useState("30");

  useEffect(() => {
    if (!tenant?.id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id, days]);

  async function load() {
    setLoading(true);
    const cutoff = new Date(Date.now() - Number(days) * 86400_000).toISOString();
    const { data } = await supabase.from("consumption_variance_v1").select("*")
      .eq("tenant_id", tenant!.id).gte("recorded_at", cutoff).order("recorded_at", { ascending: false }).limit(500);
    setRows((data || []) as VarianceRow[]);
    setLoading(false);
  }

  const byProduct = useMemo(() => {
    const m = new Map<string, { name: string; uom: string; expected: number; actual: number; entries: number }>();
    for (const r of rows) {
      if (!r.expected_qty) continue;
      const key = r.product_name;
      const cur = m.get(key) ?? { name: r.product_name, uom: r.unit_of_measure ?? "", expected: 0, actual: 0, entries: 0 };
      cur.expected += Number(r.expected_qty);
      cur.actual   += Number(r.actual_qty);
      cur.entries  += 1;
      m.set(key, cur);
    }
    return Array.from(m.values())
      .map(p => ({ ...p, variance_pct: p.expected ? ((p.actual - p.expected) / p.expected) * 100 : null }))
      .sort((a, b) => Math.abs((b.variance_pct ?? 0)) - Math.abs((a.variance_pct ?? 0)));
  }, [rows]);

  const overusers = useMemo(() => byProduct.filter(p => (p.variance_pct ?? 0) > 15).slice(0, 5), [byProduct]);

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Back-bar Variance</h1>
          <p className="text-sm text-muted-foreground">Expected (recipe) vs actual (stylist-logged) consumption.</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <p className="font-medium">No back-bar usage logged yet.</p>
          <p className="text-sm mt-1">Stylists can log actuals from the appointment detail sheet.</p>
        </CardContent></Card>
      ) : (
        <>
          {overusers.length > 0 && (
            <Card className="border-amber-300 bg-amber-50/40 dark:bg-amber-950/20">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />Over-usage hotspots (&gt;15% above recipe)
              </CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">{overusers.map(p => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-amber-700">+{(p.variance_pct ?? 0).toFixed(1)}% ({p.actual.toFixed(2)} vs {p.expected.toFixed(2)} {p.uom})</span>
                  </div>
                ))}</div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">By product</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {byProduct.map(p => (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.expected.toFixed(2)} {p.uom}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.actual.toFixed(2)} {p.uom}</TableCell>
                      <TableCell className="text-right">
                        {p.variance_pct === null ? <span className="text-muted-foreground">—</span> : (
                          <Badge variant={Math.abs(p.variance_pct) > 15 ? "destructive" : "secondary"} className="font-mono">
                            {p.variance_pct > 0 ? <TrendingUp className="inline h-3 w-3 mr-0.5" /> : <TrendingDown className="inline h-3 w-3 mr-0.5" />}
                            {p.variance_pct > 0 ? "+" : ""}{p.variance_pct.toFixed(1)}%
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{p.entries}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default BackBarVariance;
