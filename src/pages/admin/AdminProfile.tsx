import { useEffect, useState } from 'react';
import {
  User, Mail, Phone, Edit3, Save, X,
  Key, Eye, EyeOff, CheckCircle, Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';

interface Props {
  role: 'manager' | 'officer';
}

const AdminProfile = ({ role }: Props) => {
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [profile, setProfile] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    created_at: '',
    role: '',
  });
  const [editForm, setEditForm] = useState({ ...profile });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });

  /* ── Load ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('userprofile')
        .select('username, full_name, email, phone, created_at, role')
        .eq('id', user.id)
        .single();

      if (data) {
        const p = {
          username:   data.username   || '',
          full_name:  data.full_name  || '',
          email:      data.email      || user.email || '',
          phone:      data.phone      || '',
          created_at: data.created_at ? new Date(data.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
          role:       data.role       || role,
        };
        setProfile(p);
        setEditForm(p);
      }
    };
    load();
  }, [role]);

  /* ── Save profile ─────────────────────────────────────────────────────── */
  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('userprofile')
        .update({
          username:  editForm.username,
          full_name: editForm.full_name,
          phone:     editForm.phone,
        })
        .eq('id', user.id);

      if (error) throw error;
      setProfile({ ...profile, ...editForm });
      setEditing(false);
      toast({ title: 'Profile updated ✓' });
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  /* ── Change password ──────────────────────────────────────────────────── */
  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Not authenticated');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.currentPassword,
      });
      if (signInError) throw new Error('Current password is incorrect');

      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (error) throw error;

      toast({ title: 'Password changed ✓' });
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setChangingPassword(false);
    } catch (err: any) {
      toast({ title: 'Password change failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = profile.role === 'manager' ? 'Manager' : 'Claims Officer';

  return (
    <AdminLayout role={role}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">My Profile</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your account details</p>
        </div>

        {/* Profile Card */}
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-start justify-between pb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{profile.username || '—'}</CardTitle>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <Badge variant="outline" className="mt-1.5 text-xs bg-primary/5 text-primary border-primary/20">
                  <Shield className="w-3 h-3 mr-1" />{roleLabel}
                </Badge>
              </div>
            </div>
            {!editing && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => { setEditForm({ ...profile }); setEditing(true); }}>
                <Edit3 className="w-4 h-4" /> Edit
              </Button>
            )}
          </CardHeader>

          <CardContent className="space-y-5">
            {editing ? (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Display Name</Label>
                    <Input id="username" value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input id="full_name" value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254 7XX XXX XXX" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={editForm.email} disabled className="bg-muted/50" />
                    <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? 'Saving…' : <><Save className="w-4 h-4" /> Save Changes</>}
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                    <X className="w-4 h-4 mr-2" /> Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { icon: User,  label: 'Display Name', value: profile.username   || '—' },
                  { icon: User,  label: 'Full Name',     value: profile.full_name  || '—' },
                  { icon: Mail,  label: 'Email',         value: profile.email      || '—' },
                  { icon: Phone, label: 'Phone',         value: profile.phone      || '—' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {profile.created_at && (
              <>
                <Separator />
                <p className="text-xs text-muted-foreground">Account created on {profile.created_at}</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Password Card */}
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-start justify-between pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="w-4 h-4" /> Change Password
              </CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </div>
            {!changingPassword && (
              <Button variant="outline" size="sm" onClick={() => setChangingPassword(true)}>Change</Button>
            )}
          </CardHeader>

          {changingPassword && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="curPwd">Current Password</Label>
                <div className="relative">
                  <Input
                    id="curPwd"
                    type={showCurrent ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                    placeholder="Enter current password"
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
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                    placeholder="Min 8 characters"
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
              <div className="flex gap-3">
                <Button
                  onClick={handleChangePassword}
                  disabled={saving || !passwordForm.currentPassword || !passwordForm.newPassword}
                  className="gap-2"
                >
                  {saving ? 'Updating…' : <><CheckCircle className="w-4 h-4" /> Update Password</>}
                </Button>
                <Button variant="outline" onClick={() => { setChangingPassword(false); setPasswordForm({ currentPassword: '', newPassword: '' }); }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminProfile;
