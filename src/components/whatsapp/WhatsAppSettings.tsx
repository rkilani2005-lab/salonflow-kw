import { useState } from 'react';
import { Plus, X, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWhatsAppConfig } from '@/hooks/useWhatsAppConfig';
import { cn } from '@/lib/utils';

export function WhatsAppSettings() {
  const { config, isLoading, updateConfig, isUpdating } = useWhatsAppConfig();
  const [localConfig, setLocalConfig] = useState(config);
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');

  // Sync local state when config loads
  if (config && !localConfig) {
    setLocalConfig(config);
  }

  const handleSave = () => {
    if (!localConfig) return;
    updateConfig({
      is_enabled: localConfig.is_enabled,
      voice_enabled: localConfig.voice_enabled,
      owner_phone_numbers: localConfig.owner_phone_numbers,
      staff_phone_numbers: localConfig.staff_phone_numbers,
      welcome_message_en: localConfig.welcome_message_en,
      welcome_message_ar: localConfig.welcome_message_ar,
      max_retry_attempts: localConfig.max_retry_attempts,
    });
  };

  const addPhoneNumber = (type: 'owner' | 'staff') => {
    if (!localConfig) return;
    const phone = type === 'owner' ? newOwnerPhone : newStaffPhone;
    if (!phone.trim()) return;

    const key = type === 'owner' ? 'owner_phone_numbers' : 'staff_phone_numbers';
    const current = localConfig[key] || [];
    
    if (!current.includes(phone.trim())) {
      setLocalConfig({
        ...localConfig,
        [key]: [...current, phone.trim()],
      });
    }

    if (type === 'owner') setNewOwnerPhone('');
    else setNewStaffPhone('');
  };

  const removePhoneNumber = (type: 'owner' | 'staff', phone: string) => {
    if (!localConfig) return;
    const key = type === 'owner' ? 'owner_phone_numbers' : 'staff_phone_numbers';
    setLocalConfig({
      ...localConfig,
      [key]: localConfig[key]?.filter((p) => p !== phone) || [],
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Toggle */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-3">
            <div className={cn(
              "w-3 h-3 rounded-full",
              localConfig?.is_enabled ? "bg-green-500 animate-pulse" : "bg-zinc-600"
            )} />
            WhatsApp AI Agent
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Enable the AI-powered WhatsApp assistant for bookings and business intelligence
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled" className="text-zinc-300">Enable WhatsApp Agent</Label>
            <Switch
              id="enabled"
              checked={localConfig?.is_enabled || false}
              onCheckedChange={(checked) => setLocalConfig(prev => prev ? { ...prev, is_enabled: checked } : prev)}
              className="data-[state=checked]:bg-amber-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="voice" className="text-zinc-300">Voice Messages</Label>
              <p className="text-xs text-zinc-500">Process voice messages with ElevenLabs transcription</p>
            </div>
            <Switch
              id="voice"
              checked={localConfig?.voice_enabled || false}
              onCheckedChange={(checked) => setLocalConfig(prev => prev ? { ...prev, voice_enabled: checked } : prev)}
              className="data-[state=checked]:bg-amber-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Phone Numbers */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Owner Numbers */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100 text-lg">👔 Owner Numbers</CardTitle>
            <CardDescription className="text-zinc-400">
              These numbers have full access to business intelligence reports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {localConfig?.owner_phone_numbers?.map((phone) => (
              <div key={phone} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2">
                <span className="text-zinc-300 text-sm font-mono">{phone}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removePhoneNumber('owner', phone)}
                  className="h-6 w-6 text-zinc-500 hover:text-red-400 hover:bg-transparent"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="+965 1234 5678"
                value={newOwnerPhone}
                onChange={(e) => setNewOwnerPhone(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => addPhoneNumber('owner')}
                className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Staff Numbers */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100 text-lg">📱 Staff Numbers</CardTitle>
            <CardDescription className="text-zinc-400">
              Staff members with limited report access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {localConfig?.staff_phone_numbers?.map((phone) => (
              <div key={phone} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2">
                <span className="text-zinc-300 text-sm font-mono">{phone}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removePhoneNumber('staff', phone)}
                  className="h-6 w-6 text-zinc-500 hover:text-red-400 hover:bg-transparent"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="+965 9876 5432"
                value={newStaffPhone}
                onChange={(e) => setNewStaffPhone(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => addPhoneNumber('staff')}
                className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Welcome Messages */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 text-lg">👋 Welcome Messages</CardTitle>
          <CardDescription className="text-zinc-400">
            Customize greeting messages for new conversations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-zinc-300 mb-2 block">English</Label>
            <Textarea
              value={localConfig?.welcome_message_en || ''}
              onChange={(e) => setLocalConfig(prev => prev ? { ...prev, welcome_message_en: e.target.value } : prev)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 min-h-[80px]"
              placeholder="Welcome to our salon! How can I help you today?"
            />
          </div>
          <div>
            <Label className="text-zinc-300 mb-2 block">العربية (Arabic)</Label>
            <Textarea
              dir="rtl"
              value={localConfig?.welcome_message_ar || ''}
              onChange={(e) => setLocalConfig(prev => prev ? { ...prev, welcome_message_ar: e.target.value } : prev)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 min-h-[80px] text-right"
              placeholder="أهلاً وسهلاً بك في صالوننا! كيف يمكنني مساعدتك اليوم؟"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isUpdating}
          className="bg-amber-500 hover:bg-amber-600 text-black font-medium px-6"
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
