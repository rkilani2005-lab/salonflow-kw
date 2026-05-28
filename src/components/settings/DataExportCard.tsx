import { useState } from 'react';
import { Download, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-salon-data`;

export const DataExportCard = () => {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error(ar ? 'الجلسة منتهية' : 'No active session');

      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || `Export failed (${res.status})`);
      }

      // Filename from Content-Disposition
      const cd = res.headers.get('content-disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] || `salon-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({
        title: ar ? 'تم تنزيل النسخة الاحتياطية' : 'Export downloaded',
        description: ar ? 'تم حفظ ملف Excel على جهازك.' : 'Your Excel file has been saved.',
      });
    } catch (err) {
      toast({
        title: ar ? 'فشل التصدير' : 'Export failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          {ar ? 'النسخ الاحتياطي والتصدير' : 'Backup & Export'}
        </CardTitle>
        <CardDescription className="text-xs">
          {ar
            ? 'قم بتنزيل نسخة كاملة من بيانات صالونك بصيغة Excel — للنسخ الاحتياطي أو للانتقال إلى نظام آخر. بياناتك ملكك دائمًا.'
            : "Download a complete copy of your salon's data as an Excel file — for backup or to move to another system. Your data is always yours."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleExport} disabled={loading} className="gap-2">
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" />{ar ? 'جاري تحضير الملف…' : 'Preparing your file…'}</>
            : <><Download className="h-4 w-4" />{ar ? 'تصدير جميع بياناتي (Excel)' : 'Export all my data (Excel)'}</>}
        </Button>
      </CardContent>
    </Card>
  );
};
