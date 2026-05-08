import { useEffect, useState } from 'react';
import {
  User, Mail, Phone, CreditCard, Shield,
  Edit3, Save, X, Camera, CheckCircle, Key, Eye, EyeOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabaseClient';

const CustomerProfile = () => {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [profile, setProfile] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    id_number: '',
    created_at: '',
  });

  const [editForm, setEditForm] = useState({ ...profile });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('userprofile')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        const p = {
          username: data.username || '',
          full_name: data.full_name || '',
          email: user.email || '',
          phone: data.phone || '',
          id_number: data.id_number || '',
          created_at: new Date(user.created_at).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'long', year: 'numeric'
          }),
        };
        setProfile(p);
        setEditForm(p);
      }
    };

    load();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('userprofile')
        .update({
          username: editForm.username,
          full_name: editForm.full_name,
          phone: editForm.phone,
          id_number: editForm.id_number,
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({ ...editForm });
      setEditing(false);
      toast({ title: 'Profile updated successfully ✓' });
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast({ title: 'Passwords do not match', variant: 'destructive' });
    }
    if (passwordForm.newPassword.length < 6) {
      return toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;

      setChangingPassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({ title: 'Password updated successfully ✓' });
    } catch (err: any) {
      toast({ title: 'Password change failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto pb-10">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your personal information and account details</p>
        </div>

        {/* Profile Header Card */}
        <Card className="shadow-sm border-border/50 overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
          <CardContent className="px-6 pb-6 -mt-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-primary/20 border-4 border-background flex items-center justify-center shadow-md">
                  <span className="text-3xl font-bold text-primary">
                    {profile.username?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-sm hover:bg-primary/90 transition-colors">
                  <Camera className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{profile.full_name || profile.username}</h2>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="secondary" className="bg-success/10 text-success border-success/20 text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" /> Verified
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Member since {profile.created_at}
                  </Badge>
                </div>
              </div>
              <Button
                variant={editing ? "outline" : "default"}
                size="sm"
                onClick={() => {
                  if (editing) {
                    setEditForm({ ...profile });
                    setEditing(false);
                  } else {
                    setEditing(true);
                  }
                }}
                className="shrink-0"
              >
                {editing ? <><X className="w-4 h-4 mr-1.5" /> Cancel</> : <><Edit3 className="w-4 h-4 mr-1.5" /> Edit Profile</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Personal Information
            </CardTitle>
            <CardDescription>Your personal details and contact information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Username</Label>
                {editing ? (
                  <Input
                    value={editForm.username}
                    onChange={(e) => setEditForm(f => ({ ...f, username: e.target.value }))}
                    className="h-9"
                  />
                ) : (
                  <p className="font-medium text-sm py-2 px-3 bg-muted/40 rounded-md">{profile.username || '—'}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Full Name</Label>
                {editing ? (
                  <Input
                    value={editForm.full_name}
                    onChange={(e) => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                    className="h-9"
                  />
                ) : (
                  <p className="font-medium text-sm py-2 px-3 bg-muted/40 rounded-md">{profile.full_name || '—'}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email Address
                </Label>
                <p className="font-medium text-sm py-2 px-3 bg-muted/40 rounded-md text-muted-foreground">
                  {profile.email} <span className="text-xs">(cannot be changed)</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Phone Number
                </Label>
                {editing ? (
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="07XXXXXXXX"
                    className="h-9"
                  />
                ) : (
                  <p className="font-medium text-sm py-2 px-3 bg-muted/40 rounded-md">{profile.phone || '—'}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <CreditCard className="w-3 h-3" /> National ID Number
                </Label>
                {editing ? (
                  <Input
                    value={editForm.id_number}
                    onChange={(e) => setEditForm(f => ({ ...f, id_number: e.target.value }))}
                    placeholder="ID Number"
                    className="h-9"
                  />
                ) : (
                  <p className="font-medium text-sm py-2 px-3 bg-muted/40 rounded-md">{profile.id_number || '—'}</p>
                )}
              </div>
            </div>

            {editing && (
              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={loading} className="bg-primary hover:bg-primary/90">
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Security
            </CardTitle>
            <CardDescription>Manage your password and account security</CardDescription>
          </CardHeader>
          <CardContent>
            {!changingPassword ? (
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Key className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Password</p>
                    <p className="text-xs text-muted-foreground">Last changed: recently</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChangingPassword(true)}
                >
                  Change Password
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">New Password</Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                      placeholder="Enter new password"
                      className="h-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                      className="h-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setChangingPassword(false);
                      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handlePasswordChange}
                    disabled={loading}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CustomerProfile;
