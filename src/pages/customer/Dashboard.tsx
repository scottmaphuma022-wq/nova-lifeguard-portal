import { FileText, CreditCard, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import DashboardLayout from '@/components/DashboardLayout';
import { useNavigate } from 'react-router-dom';

const stats = [
  {
    title: 'Total Claims',
    value: '5',
    description: 'Claims submitted',
    icon: FileText,
    trend: '+2 this month',
    color: 'primary',
  },
  {
    title: 'Total Paid',
    value: 'KSH 45,000',
    description: 'Premiums paid',
    icon: CreditCard,
    trend: 'On track',
    color: 'success',
  },
  {
    title: 'Pending Claims',
    value: '2',
    description: 'Awaiting review',
    icon: Clock,
    trend: 'Under review',
    color: 'warning',
  },
];

const recentClaims = [
  { id: 'CLM-001', type: 'Funeral Expenses', amount: 'KSH 150,000', status: 'Approved', date: '2024-01-15' },
  { id: 'CLM-002', type: 'Loan Guard', amount: 'KSH 200,000', status: 'Pending', date: '2024-01-20' },
  { id: 'CLM-003', type: 'Disability', amount: 'KSH 100,000', status: 'Under Review', date: '2024-01-22' },
];

const statusColors: Record<string, string> = {
  Approved: 'bg-success/10 text-success',
  Pending: 'bg-warning/10 text-warning',
  'Under Review': 'bg-info/10 text-info',
  Rejected: 'bg-destructive/10 text-destructive',
};

const CustomerDashboard = () => {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Welcome back, John!</h1>
          <p className="text-muted-foreground">Here's an overview of your insurance account.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.title} className="border-0 shadow-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`w-10 h-10 rounded-xl bg-${stat.color}/10 flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 text-${stat.color === 'primary' ? 'primary' : stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Coverage Progress */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Your Coverage</CardTitle>
            <CardDescription>Active insurance plans and utilization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Funeral Expenses Cover</span>
                <span className="text-sm text-muted-foreground">KSH 150,000 / 500,000</span>
              </div>
              <Progress value={30} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Loan Guard Cover</span>
                <span className="text-sm text-muted-foreground">KSH 200,000 / 1,000,000</span>
              </div>
              <Progress value={20} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Disability Cover</span>
                <span className="text-sm text-muted-foreground">KSH 0 / 300,000</span>
              </div>
              <Progress value={0} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Recent Claims */}
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Claims</CardTitle>
              <CardDescription>Your latest claim submissions</CardDescription>
            </div>
            <Button variant="outline" onClick={() => navigate('/claims')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{claim.type}</p>
                      <p className="text-sm text-muted-foreground">{claim.id} • {claim.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{claim.amount}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[claim.status]}`}>
                      {claim.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-0 shadow-card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/claims')}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Submit a Claim</h3>
                <p className="text-sm text-muted-foreground">File a new insurance claim</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/payments')}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Make a Payment</h3>
                <p className="text-sm text-muted-foreground">Pay your insurance premium</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CustomerDashboard;
