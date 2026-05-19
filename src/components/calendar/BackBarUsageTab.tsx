import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase as _sb } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _sb as any;

interface Props { bookingId: string; serviceId: string | null; }

interface RecipeRow {
  product_id: string;
  product_name: string;
  unit: string | null;
  expected_qty: number;
  actual_qty: number;
  persisted_actual: number | null;
}

function variancePct(actual: number, expected: number) {
  if (!expected) return 0;
  return ((actual - expected) / expected) * 100;
}

function varianceBadge(actual: number, expected: number) {
  const v = Math.abs(variancePct(actual, expected));
  if (v <= 10) return <Badge className="bg-emerald-500/15 text-emerald-700">±{v.toFixed(0)}%</Badge>;
  if (v <= 25) return <Badge className="bg-amber-500/15 text-amber-700">±{v.toFixed(0)}%</Badge>;
  return <Badge className="bg-red-500/15 text-red-700">±{v.toFixed(0)}%</Badge>;
}

export function BackBarUsageTab({ bookingId, serviceId }: Props) {
  const { tenant, profile } = useAuth();
  const [rows, setRows] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [recipeR, actualR] = await Promise.all([
          serviceId
            ? supabase.from("service_recipes")
                .select("product_id, quantity_per_service, product:products(id, name, unit)")
                .eq("service_id", serviceId)
            : Promise.resolve({ data: [] }),
          supabase.from("service_actual_usage")
            .select("product_id, actual_qty")
            .eq("booking_id", bookingId),
        ]);
        if (cancelled) return;
        const actualMap = new Map<string, number>(
          (actualR.data ?? []).map((r: any) => [r.product_id, Number(r.actual_qty)])
        );
        const merged: RecipeRow[] = (recipeR.data ?? []).map((r: any) => {
          const expected = Number(r.quantity_per_service) || 0;
          const persisted = actualMap.has(r.product_id) ? actualMap.get(r.product_id)! : null;
          return {
            product_id: r.product_id,
            product_name: r.product?.name ?? "Unknown",
            unit: r.product?.unit ?? null,
            expected_qty: expected,
            actual_qty: persisted ?? expected,
            persisted_actual: persisted,
          };
        });
        setRows(merged);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId, serviceId]);

  const dirty = useMemo(
    () => rows.some(r => r.persisted_actual === null || r.persisted_actual !== r.actual_qty),
    [rows],
  );

  const save = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      const payload = rows
        .filter(r => r.persisted_actual === null || r.persisted_actual !== r.actual_qty)
        .map(r => ({
          tenant_id: tenant.id,
          booking_id: bookingId,
          service_id: serviceId,
          product_id: r.product_id,
          expected_qty: r.expected_qty,
          actual_qty: r.actual_qty,
          recorded_by: profile?.id ?? null,
        }));
      if (!payload.length) return;
      const { error } = await supabase
        .from("service_actual_usage")
        .upsert(payload, { onConflict: "booking_id,product_id" });
      if (error) throw error;
      setRows(prev => prev.map(r => ({ ...r, persisted_actual: r.actual_qty })));
      toast.success("Usage recorded");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading recipe…</p>;
  if (!rows.length) {
    return (
      <div className="text-sm text-muted-foreground space-y-2">
        <p>No recipe defined for this service.</p>
        <Link to="/services" className="text-primary underline">Define one</Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Expected</TableHead>
            <TableHead className="w-32">Actual</TableHead>
            <TableHead className="text-right">Variance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.product_id}>
              <TableCell className="font-medium">{r.product_name}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.unit ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{r.expected_qty.toFixed(3)}</TableCell>
              <TableCell>
                <Input type="number" step="0.001" min={0}
                  value={r.actual_qty}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    setRows(prev => prev.map((x, idx) => idx === i ? { ...x, actual_qty: v } : x));
                  }}
                />
              </TableCell>
              <TableCell className="text-right">{varianceBadge(r.actual_qty, r.expected_qty)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save usage"}
        </Button>
      </div>
    </div>
  );
}
