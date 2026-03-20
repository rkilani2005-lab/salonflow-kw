import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Loader2, Edit2, Eye, MessageSquare, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  trigger_event: string;
  is_active: boolean;
  body_en: string;
  body_ar: string | null;
  meta_status: string;
}

const VARIABLE_CHIPS = [
  '{{client_name}}', '{{service}}', '{{date}}', '{{time}}',
  '{{staff}}', '{{amount}}', '{{payment_method}}', '{{services_list}}',
];

const TRIGGER_LABELS: Record<string, string> = {
  booking_confirmed: 'Booking Confirmed',
  reminder_24h:      '24h Reminder',
  reminder_1h:       '1h Reminder',
  booking_cancelled: 'Cancellation',
  receipt_sent:      'Payment Receipt',
  reengagement:      'Re-engagement',
};

// Render a preview with variables replaced by sample data
const SAMPLE_VARS: Record<string, string> = {
  client_name: 'Fatima',
  service: 'Hair Coloring',
  date: 'Monday, March 25',
  time: '2:00 PM',
  staff: 'Sara',
  amount: '18.000',
  payment_method: 'K-NET',
  services_list: 'Hair Coloring, Blowout',
};

function previewTemplate(body: string): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => SAMPLE_VARS[key] || `[${key}]`);
}

export function WhatsAppTemplates() {
  const { tenant } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editOpen,  setEditOpen]  = useState(false);
  const [editing,   setEditing]   = useState<Template | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [preview,   setPreview]   = useState(false);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('tenant_id', tenant!.id)
      .order('trigger_event');
    setTemplates((data || []) as Template[]);
    setLoading(false);
  };

  const openEdit = (tpl: Template) => {
    setEditing({ ...tpl });
    setPreview(false);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .update({ body_en: editing.body_en, body_ar: editing.body_ar, name: editing.name })
        .eq('id', editing.id);
      if (error) throw error;
      setTemplates(prev => prev.map(t => t.id === editing.id ? { ...t, ...editing } : t));
      setEditOpen(false);
      toast({ title: '✅ Template saved' });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const insertVar = (field: 'en' | 'ar', variable: string) => {
    if (!editing) return;
    const key = field === 'en' ? 'body_en' : 'body_ar';
    setEditing({ ...editing, [key]: (editing[key] || '') + variable });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      local:    'bg-muted text-muted-foreground border-border',
      pending:  'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-700',
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-700',
      rejected: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:border-red-700',
    };
    return (
      <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 rounded-sm font-bold', map[status] || map.local)}>
        {status}
      </Badge>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (templates.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
      <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm font-medium">No templates yet</p>
      <p className="text-xs text-muted-foreground">Go to the Triggers tab and click "Create Default Automations" first.</p>
    </div>
  );

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <p className="text-sm font-semibold">{templates.length} message templates</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Click Edit to customise any template. Variables like {'{{client_name}}'} are replaced automatically.
        </p>
      </div>

      <div className="border rounded-md overflow-hidden divide-y divide-border">
        {templates.map(tpl => (
          <div key={tpl.id} className="flex items-start gap-4 px-5 py-4 bg-card hover:bg-muted/20 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-semibold">{tpl.name}</p>
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 rounded-sm font-bold">
                  {TRIGGER_LABELS[tpl.trigger_event] || tpl.trigger_event}
                </Badge>
                {statusBadge(tpl.meta_status || 'local')}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 font-mono leading-relaxed">
                {tpl.body_en.slice(0, 120)}{tpl.body_en.length > 120 ? '...' : ''}
              </p>
            </div>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs flex-shrink-0"
              onClick={() => openEdit(tpl)}>
              <Edit2 className="h-3 w-3" />Edit
            </Button>
          </div>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Template — {editing?.name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              {/* Variable chips */}
              <div>
                <Label className="text-xs font-semibold mb-2 block">Available Variables</Label>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLE_CHIPS.map(v => (
                    <div key={v} className="flex gap-0.5">
                      <button onClick={() => insertVar('en', v)}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/8 border border-primary/20 text-primary hover:bg-primary/15 transition-colors">
                        {v} <span className="text-muted-foreground ml-0.5">EN</span>
                      </button>
                      <button onClick={() => insertVar('ar', v)}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground hover:bg-primary/8 hover:border-primary/20 hover:text-primary transition-colors">
                        AR
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Toggle preview */}
              <div className="flex justify-end">
                <button onClick={() => setPreview(p => !p)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {preview ? <Edit2 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {preview ? 'Edit' : 'Preview with sample data'}
                </button>
              </div>

              {preview ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">English Preview</Label>
                    <div className="bg-[#e7fdd8] dark:bg-emerald-950/30 rounded-xl px-4 py-3 text-sm whitespace-pre-wrap font-sans leading-relaxed border border-emerald-200 dark:border-emerald-800">
                      {previewTemplate(editing.body_en)}
                    </div>
                  </div>
                  {editing.body_ar && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Arabic Preview</Label>
                      <div className="bg-[#e7fdd8] dark:bg-emerald-950/30 rounded-xl px-4 py-3 text-sm whitespace-pre-wrap font-sans leading-relaxed border border-emerald-200 dark:border-emerald-800" dir="rtl">
                        {previewTemplate(editing.body_ar)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">English Message</Label>
                    <Textarea
                      value={editing.body_en}
                      onChange={e => setEditing({ ...editing, body_en: e.target.value })}
                      rows={10} className="font-mono text-xs resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Arabic Message</Label>
                    <Textarea
                      value={editing.body_ar || ''}
                      onChange={e => setEditing({ ...editing, body_ar: e.target.value })}
                      rows={10} className="font-mono text-xs resize-none" dir="rtl"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
