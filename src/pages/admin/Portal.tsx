import { useNavigate } from 'react-router-dom';
import { Shield, Users, UserCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

const AdminPortal = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    // Auto-redirect based on role
    if (isAuthenticated && user) {
      if (user.role === 'manager') {
        navigate('/novaportal/manager');
      } else if (user.role === 'officer') {
        navigate('/novaportal/officer');
      }
    }
  }, [isAuthenticated, user, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <div className="w-16 h-16 rounded-2xl teal-gradient-bg flex items-center justify-center mx-auto mb-6 shadow-teal">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">Nova Portal</h1>
          <p className="text-lg text-muted-foreground">
            Admin access for Claims Officers and Managers
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Manager Card */}
          <Card className="border-0 shadow-card hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer" onClick={() => navigate('/novaportal/manager')}>
            <CardHeader className="text-center">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <CardTitle>Manager Dashboard</CardTitle>
              <CardDescription>
                Manage claims, officers, and view analytics
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button className="w-full">Access Manager Portal</Button>
              <p className="text-xs text-muted-foreground mt-4">
                Login: admin / admin123
              </p>
            </CardContent>
          </Card>

          {/* Claims Officer Card */}
          <Card className="border-0 shadow-card hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer" onClick={() => navigate('/novaportal/officer')}>
            <CardHeader className="text-center">
              <div className="w-14 h-14 rounded-xl bg-info/10 flex items-center justify-center mx-auto mb-4">
                <UserCheck className="h-7 w-7 text-info" />
              </div>
              <CardTitle>Claims Officer Dashboard</CardTitle>
              <CardDescription>
                Process claims and manage B2C payments
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="outline" className="w-full">Access Officer Portal</Button>
              <p className="text-xs text-muted-foreground mt-4">
                Login: officer / officer1
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminPortal;
