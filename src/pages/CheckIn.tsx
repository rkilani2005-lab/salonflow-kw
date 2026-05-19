import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

interface CheckInResult {
  ok: boolean;
  already?: boolean;
  message?: string;
  error?: string;
  service?: { name: string; name_ar?: string | null } | null;
}

export default function CheckIn() {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("customer-checkin", { body: { token } });
        if (error) setResult({ ok: false, error: error.message });
        else setResult(data as CheckInResult);
      } catch (e) {
        setResult({ ok: false, error: (e as Error).message });
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Checking you in…</p>
        </div>
      </div>
    );
  }

  const success = result?.ok ?? false;
  const Icon = success ? CheckCircle2 : (result?.error === "too_early" ? Clock : XCircle);
  const color = success ? "text-emerald-500" : (result?.error === "too_early" ? "text-amber-500" : "text-red-500");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-6">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-lg p-8 text-center space-y-4">
        <Icon className={`h-16 w-16 mx-auto ${color}`} />
        <h1 className="text-2xl font-bold">
          {success
            ? (result?.already ? "Already checked in" : "Checked in")
            : (result?.error === "too_early" ? "Too early" : "Couldn't check you in")}
        </h1>
        <p className="text-muted-foreground">
          {result?.message ?? result?.error ?? "Please speak with reception."}
        </p>
        {result?.service?.name && (
          <p className="text-sm text-muted-foreground border-t pt-3 mt-3">
            For: {result.service.name}
          </p>
        )}
      </div>
    </div>
  );
}
