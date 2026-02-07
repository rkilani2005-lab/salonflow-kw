import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Clock, 
  Bell, 
  Globe, 
  Palette,
  Save,
  Upload,
  User,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';

export default function Settings() {
  const { tenant, profile, currentBranch } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Form states
  const [businessName, setBusinessName] = useState(tenant?.name || '');
  const [ownerName, setOwnerName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(currentBranch?.phone || '');
  const [address, setAddress] = useState(currentBranch?.address || '');
  const [currency, setCurrency] = useState('KWD');
  const [timezone, setTimezone] = useState('Asia/Kuwait');
  const [language, setLanguage] = useState('en');

  // Working hours
  const [openTime, setOpenTime] = useState(currentBranch?.opening_time?.slice(0, 5) || '09:00');
  const [closeTime, setCloseTime] = useState(currentBranch?.closing_time?.slice(0, 5) || '21:00');

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [bookingReminders, setBookingReminders] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    toast({
      title: 'Settings saved',
      description: 'Your settings have been updated successfully.',
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your salon's settings and preferences
        </p>
      </div>

      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="business" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Business</span>
          </TabsTrigger>
          <TabsTrigger value="hours" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Hours</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Preferences</span>
          </TabsTrigger>
        </TabsList>

        {/* Business Profile */}
        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Profile</CardTitle>
              <CardDescription>
                Update your salon's business information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Upload */}
              <div className="flex items-center gap-6">
                <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center border-2 border-dashed">
                  {tenant?.logo_url ? (
                    <img src={tenant.logo_url} alt="Logo" className="h-full w-full object-cover rounded-lg" />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Logo
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG up to 2MB. Recommended: 200x200px
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="businessName">
                    <Building2 className="h-4 w-4 inline mr-2" />
                    Business Name
                  </Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Your Salon Name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ownerName">
                    <User className="h-4 w-4 inline mr-2" />
                    Owner Name
                  </Label>
                  <Input
                    id="ownerName"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Owner's Full Name"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">
                      <Mail className="h-4 w-4 inline mr-2" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@salon.com"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">
                      <Phone className="h-4 w-4 inline mr-2" />
                      Phone
                    </Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+965 1234 5678"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="address">
                    <MapPin className="h-4 w-4 inline mr-2" />
                    Address
                  </Label>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Your salon address"
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Working Hours */}
        <TabsContent value="hours" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Working Hours</CardTitle>
              <CardDescription>
                Set your salon's operating hours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="openTime">Opening Time</Label>
                  <Input
                    id="openTime"
                    type="time"
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="closeTime">Closing Time</Label>
                  <Input
                    id="closeTime"
                    type="time"
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-4">Weekly Schedule</h4>
                <div className="space-y-3">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                    <div key={day} className="flex items-center justify-between py-2 px-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Switch defaultChecked={day !== 'Friday'} />
                        <span className="font-medium">{day}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {day === 'Friday' ? 'Closed' : `${openTime} - ${closeTime}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Manage how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive booking updates via email
                    </p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">SMS Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive important alerts via SMS
                    </p>
                  </div>
                  <Switch
                    checked={smsNotifications}
                    onCheckedChange={setSmsNotifications}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Booking Reminders</p>
                    <p className="text-sm text-muted-foreground">
                      Send reminders to clients before appointments
                    </p>
                  </div>
                  <Switch
                    checked={bookingReminders}
                    onCheckedChange={setBookingReminders}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Marketing Emails</p>
                    <p className="text-sm text-muted-foreground">
                      Receive product updates and offers
                    </p>
                  </div>
                  <Switch
                    checked={marketingEmails}
                    onCheckedChange={setMarketingEmails}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Regional & Display Preferences</CardTitle>
              <CardDescription>
                Customize your salon's regional settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KWD">KWD - Kuwaiti Dinar</SelectItem>
                      <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                      <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Kuwait">Asia/Kuwait (GMT+3)</SelectItem>
                      <SelectItem value="Asia/Riyadh">Asia/Riyadh (GMT+3)</SelectItem>
                      <SelectItem value="Asia/Dubai">Asia/Dubai (GMT+4)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="language">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية (Arabic)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-4">Theme</h4>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1">
                    <Palette className="h-4 w-4 mr-2" />
                    Light
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Palette className="h-4 w-4 mr-2" />
                    Dark
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Palette className="h-4 w-4 mr-2" />
                    System
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
