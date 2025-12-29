import { useState } from 'react';
import { Users, Trash2, Key, Plus, Mail, UserCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/AdminLayout';

interface Officer {
  id: number;
  name: string;
  email: string;
  role: string;
  assignedClaims: number;
  status: 'Active' | 'Inactive';
}

const initialOfficers: Officer[] = [
  { id: 1, name: 'Sarah Claims', email: 'sarah@nova.co.ke', role: 'Claims Officer', assignedClaims: 12, status: 'Active' },
  { id: 2, name: 'John Processor', email: 'john@nova.co.ke', role: 'Claims Officer', assignedClaims: 8, status: 'Active' },
  { id: 3, name: 'Jane Handler', email: 'jane@nova.co.ke', role: 'Claims Officer', assignedClaims: 15, status: 'Active' },
];

const ManagerSettings = () => {
  const [officers, setOfficers] = useState(initialOfficers);
  const [newOfficerName, setNewOfficerName] = useState('');
  const [newOfficerEmail, setNewOfficerEmail] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { toast } = useToast();

  const handleAddOfficer = () => {
    if (!newOfficerName || !newOfficerEmail) return;

    const newOfficer: Officer = {
      id: officers.length + 1,
      name: newOfficerName,
      email: newOfficerEmail,
      role: 'Claims Officer',
      assignedClaims: 0,
      status: 'Active',
    };

    setOfficers([...officers, newOfficer]);
    setNewOfficerName('');
    setNewOfficerEmail('');
    setIsAddDialogOpen(false);

    toast({
      title: 'Officer Added',
      description: `${newOfficerName} has been added as a Claims Officer.`,
    });
  };

  const handleDeleteOfficer = (officer: Officer) => {
    setOfficers(officers.filter(o => o.id !== officer.id));
    toast({
      title: 'Officer Removed',
      description: `${officer.name} has been removed from the system.`,
      variant: 'destructive',
    });
  };

  const handleResetPassword = (officer: Officer) => {
    toast({
      title: 'Password Reset',
      description: `Password reset email sent to ${officer.email}.`,
    });
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword) return;

    toast({
      title: 'Password Changed',
      description: 'Your password has been updated successfully.',
    });
    setCurrentPassword('');
    setNewPassword('');
  };

  return (
    <AdminLayout role="manager">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage officers and account settings</p>
        </div>

        {/* Claims Officers Section */}
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Claims Officers
              </CardTitle>
              <CardDescription>Manage claims officer accounts and roles</CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Officer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Claims Officer</DialogTitle>
                  <DialogDescription>
                    Create a new claims officer account
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="Enter full name"
                      value={newOfficerName}
                      onChange={(e) => setNewOfficerName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="officer@nova.co.ke"
                      value={newOfficerEmail}
                      onChange={(e) => setNewOfficerEmail(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button className="flex-1" onClick={handleAddOfficer}>
                      Add Officer
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {officers.map((officer) => (
                <div key={officer.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserCheck className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{officer.name}</p>
                      <p className="text-sm text-muted-foreground">{officer.email}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-muted-foreground">{officer.role}</span>
                        <span className="text-xs text-primary">{officer.assignedClaims} assigned claims</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleResetPassword(officer)}
                      title="Reset Password"
                    >
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
                          <AlertDialogTitle>Delete Officer Account?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove {officer.name}'s account and reassign their claims.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteOfficer(officer)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Password Change Section */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <Button onClick={handleChangePassword} disabled={!currentPassword || !newPassword}>
                Update Password
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ManagerSettings;
