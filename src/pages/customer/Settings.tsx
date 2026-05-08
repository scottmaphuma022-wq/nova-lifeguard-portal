import { useState } from 'react';
import {
  Bell, Lock, Moon, Globe, Smartphone,
  Mail, MessageSquare, Shield, Trash2, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

interface ToggleSettingProps {
  label: string;
  description: string;
  icon: React.ElementType;
  value: boolean;
  onChange: (v: boolean) => void;
}

const ToggleSetting = ({ label, description, icon: Icon, value, onChange }: ToggleSettingProps) => (
  <div className="flex items-center justify-between py-3">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    <Switch checked={value} onCheckedChange={onChange} />
  </div>
);

const CustomerSettings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    claimUpdates: true,
    paymentReminders: true,
    promotions: false,
    security: true,
  });

  const [preferences, setPreferences] = useState({
    darkMode: false,
    twoFactor: false,
    dataSharing: false,
  });

  const handleSaveNotifications = () => {
    toast({ title: 'Notification preferences saved ✓' });
  };

  const handleDeleteAccount = async () => {
    toast({
      title: 'Account deletion requested',
      description: 'Our team will contact you within 48 hours to complete this process.',
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto pb-10">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your notification preferences and account settings</p>
        </div>

        {/* Notification Settings */}
        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Notification Preferences
            </CardTitle>
            <CardDescription>Choose how and when you'd like to be notified</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            <ToggleSetting
              icon={Mail}
              label="Email Notifications"
              description="Receive updates via email"
              value={notifications.email}
              onChange={(v) => setNotifications(n => ({ ...n, email: v }))}
            />
            <ToggleSetting
              icon={Smartphone}
              label="SMS Notifications"
              description="Receive important alerts via SMS"
              value={notifications.sms}
              onChange={(v) => setNotifications(n => ({ ...n, sms: v }))}
            />
            <ToggleSetting
              icon={Shield}
              label="Claim Status Updates"
              description="Get notified when your claim status changes"
              value={notifications.claimUpdates}
              onChange={(v) => setNotifications(n => ({ ...n, claimUpdates: v }))}
            />
            <ToggleSetting
              icon={Bell}
              label="Payment Reminders"
              description="Reminders when your premium is due"
              value={notifications.paymentReminders}
              onChange={(v) => setNotifications(n => ({ ...n, paymentReminders: v }))}
            />
            <ToggleSetting
              icon={MessageSquare}
              label="Promotions & Offers"
              description="Updates about new covers and special offers"
              value={notifications.promotions}
              onChange={(v) => setNotifications(n => ({ ...n, promotions: v }))}
            />
            <ToggleSetting
              icon={Lock}
              label="Security Alerts"
              description="Immediate alerts for suspicious account activity"
              value={notifications.security}
              onChange={(v) => setNotifications(n => ({ ...n, security: v }))}
            />

            <div className="pt-4">
              <Button onClick={handleSaveNotifications} size="sm" className="bg-primary hover:bg-primary/90">
                Save Notification Preferences
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* App Preferences */}
        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              App Preferences
            </CardTitle>
            <CardDescription>Customize your app experience</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            <ToggleSetting
              icon={Moon}
              label="Dark Mode"
              description="Switch to dark theme"
              value={preferences.darkMode}
              onChange={(v) => {
                setPreferences(p => ({ ...p, darkMode: v }));
                toast({ title: v ? 'Dark mode enabled' : 'Light mode enabled' });
              }}
            />
            <ToggleSetting
              icon={Lock}
              label="Two-Factor Authentication"
              description="Add an extra layer of security to your account"
              value={preferences.twoFactor}
              onChange={(v) => {
                setPreferences(p => ({ ...p, twoFactor: v }));
                toast({ title: v ? '2FA enabled — check your email to confirm' : '2FA disabled' });
              }}
            />
            <ToggleSetting
              icon={Globe}
              label="Data Sharing"
              description="Allow anonymized data to improve our services"
              value={preferences.dataSharing}
              onChange={(v) => setPreferences(p => ({ ...p, dataSharing: v }))}
            />
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Account Management</CardTitle>
            <CardDescription>Manage your account and related actions</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            {[
              { label: 'Privacy Policy', icon: Shield },
              { label: 'Terms & Conditions', icon: Globe },
              { label: 'Help & Support', icon: MessageSquare },
            ].map(({ label, icon: Icon }) => (
              <button
                key={label}
                className="flex items-center justify-between w-full py-3 hover:bg-muted/30 rounded-md transition-colors px-1 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="shadow-sm border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Danger Zone
            </CardTitle>
            <CardDescription>Irreversible account actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-background">
              <div>
                <p className="font-medium text-sm">Delete Account</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This will permanently delete your account and all associated data
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your account,
                      all your claims, payment history, and associated data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Yes, delete my account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CustomerSettings;
