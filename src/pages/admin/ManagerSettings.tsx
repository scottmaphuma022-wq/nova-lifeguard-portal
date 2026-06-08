import { useState, useEffect } from 'react';
import { Users, Trash2, Key, Plus, UserCheck, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';

interface Officer {
  id: string;
  username: string;
  email: string;
  assignedClaims: number;
}

const ManagerSettings = () => {
  const { toast } = useToast();

  const [officers, setOfficers]           = useState<Officer[]>([]);
  const [loading, setLoading]             = useState(true);
  const [isAddOpen, setIsAddOpen]         = useState(false);
  const [savingAdd, setSavingAdd]         = useState(false);

  // Add officer form
  const [newName, setNewName]             = useState('');
  const [newEmail, setNewEmail]           = useState('');
  const [newPassword, setNewPassword]     = useState('');

  // Change own password
  const [currentPwd, setCurrentPwd]       = useState('');
  const [newPwd, setNewPwd]               = useState('');
  const [changingPwd, setChangingPwd]     = useState(false);

  /* ── Load officers ── */
  const fetchOfficers = async () => {
    setLoading(true);
    try {
      // Get all users with role 'officer'
      const { data: profiles, error } = await supabase
        .from('userprofile')
        .select('id, username, email')
        .eq('role', 'officer')
        .order('username');

      if (error) throw error;

      // Count assigned claims per officer
      const { data: claimCounts } = await supabase
        .from('claims')
        .select('officer_id')
        .not('officer_id', 'is', null);

      const countMap: Record<string, number> = {};
      (claimCounts || []).forEach(c => {
        if (c.officer_id) countMap[c.officer_id] = (countMap[c.officer_id] || 0) + 1;
      });

      setOfficers(
        (profiles || []).map(p => ({
          id: p.id,
          username: p.username || 'Unnamed',
          email: p.email || '',
          assignedClaims: countMap[p.id] || 0,
        }))
      );
    } catch (err: any) {
      console.error('Failed to load officers:', err);
      toast({ title: 'Failed to load officers', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOfficers(); }, []);

  /* ── Add officer — creates Supabase Auth user + sets role in userprofile ── */
  const handleAddOfficer = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast({ title: 'All fields are required', variant: 'destructive' });
      return;
    }
    setSavingAdd(true);
    try {
      // Use Supabase admin API via Edge Function / server-side would be ideal,
      // but we can sign up and then set the role:
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: newEmail.trim(),
        password: newPassword.trim(),
        options: { data: { username: newName.trim() } },
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('User creation failed');

      // Set role to officer in userprofile
      await supabase.from('userprofile').upsert({
        id: signUpData.user.id,
        username: newName.trim(),
        email: newEmail.trim(),
        role: 'officer',
      });

      toast({ title: 'Officer Added', description: `${newName} has been added. They will receive a confirmation email.` });
      setNewName(''); setNewEmail(''); setNewPassword('');
      setIsAddOpen(false);
      fetchOfficers();
    } catch (err: any) {
      toast({ title: 'Failed to add officer', description: err.message, variant: 'destructive' });
    } finally {
      setSavingAdd(false);
    }
  };

  /* ── Remove officer — sets role back to 'customer' (soft delete) ── */
  const handleRemoveOfficer = async (officer: Officer) => {
    try {
      const { error } = await supabase
        .from('userprofile')
        .update({ role: 'customer' })
        .eq('id', officer.id);

      if (error) throw error;

      toast({ title: 'Officer Removed', description: `${officer.username} has been removed from officer roles.`, variant: 'destructive' });
      fetchOfficers();
    } catch (err: any) {
      toast({ title: 'Failed to remove officer', description: err.message, variant: 'destructive' });
    }
  };

  /* ── Send password reset email ── */
  const handleResetPassword = async (officer: Officer) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(officer.email);
      if (error) throw error;
      toast({ title: 'Password Reset Sent', description: `A reset link was sent to ${officer.email}.` });
    } catch (err: any) {
      toast({ title: 'Failed to send reset email', description: err.message, variant: 'destructive' });
    }
  };

  /* ── Change own password ── */
  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd) return;
    setChangingPwd(true);
    try {
      // Re-authenticate then update
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Not authenticated');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPwd,
      });
      if (signInError) throw new Error('Current password is incorrect');

      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;

      toast({ title: 'Password Changed', description: 'Your password has been updated.' });
      setCurrentPwd(''); setNewPwd('');
    } catch (err: any) {
      toast({ title: 'Failed to change password', description: err.message, variant: 'destructive' });
    } finally {
      setChangingPwd(false);
    }
  };

  return (
    <AdminLayout role="manager">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage officers and account settings</p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchOfficers} disabled={loading} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Officers */}
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Claims Officers
              </CardTitle>
              <CardDescription>Manage claims officer accounts and roles</CardDescription>
            </div>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Add Officer</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Claims Officer</DialogTitle>
                  <DialogDescription>Create a new officer account. They'll receive a confirmation email.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="newName">Full Name</Label>
                    <Input id="newName" placeholder="Enter full name" value={newName} onChange={e => setNewName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newEmail">Email Address</Label>
                    <Input id="newEmail" type="email" placeholder="officer@nova.co.ke" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPwd">Temporary Password</Label>
                    <Input id="newPwd" type="password" placeholder="Min 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                    <Button className="flex-1" onClick={handleAddOfficer} disabled={savingAdd}>
                      {savingAdd ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding…</> : 'Add Officer'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading officers…</p>
              </div>
            ) : officers.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground">No officers found. Add one above.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {officers.map(officer => (
                  <div key={officer.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <UserCheck className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{officer.username}</p>
                        <p className="text-sm text-muted-foreground">{officer.email}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-muted-foreground">Claims Officer</span>
                          <span className="text-xs text-primary">{officer.assignedClaims} assigned claims</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleResetPassword(officer)} title="Send Password Reset">
                        <Key className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Officer?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove {officer.username}'s officer access. Their account will remain but they'll lose officer privileges.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveOfficer(officer)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change own password */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" /> Change Password
            </CardTitle>
            <CardDescription>Update your manager account password</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input id="currentPassword" type="password" placeholder="Enter current password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input id="newPassword" type="password" placeholder="Enter new password" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
              </div>
              <Button onClick={handleChangePassword} disabled={!currentPwd || !newPwd || changingPwd}>
                {changingPwd ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating…</> : 'Update Password'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ManagerSettings;
