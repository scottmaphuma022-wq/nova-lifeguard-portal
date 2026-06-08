import { useState } from 'react';
import { Key, Eye, EyeOff, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';

const OfficerSettings = () => {
  const { toast } = useToast();

  const [currentPwd, setCurrentPwd]   = useState('');
  const [newPwd, setNewPwd]           = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [saving, setSaving]           = useState(false);

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Not authenticated');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPwd,
      });
      if (signInError) throw new Error('Current password is incorrect');

      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;

      toast({ title: 'Password changed ✓', description: 'Your password has been updated.' });
      setCurrentPwd('');
      setNewPwd('');
    } catch (err: any) {
      toast({ title: 'Failed to change password', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout role="officer">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your account settings</p>
        </div>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" /> Change Password
            </CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="curPwd">Current Password</Label>
              <div className="relative">
                <Input
                  id="curPwd"
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="Enter current password"
                  value={currentPwd}
                  onChange={e => setCurrentPwd(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowCurrent(v => !v)}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPwd">New Password</Label>
              <div className="relative">
                <Input
                  id="newPwd"
                  type={showNew ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowNew(v => !v)}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              onClick={handleChangePassword}
              disabled={saving || !currentPwd || !newPwd}
              className="gap-2"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                : <><CheckCircle className="w-4 h-4" /> Update Password</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default OfficerSettings;
