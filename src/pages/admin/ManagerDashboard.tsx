import { FileText, CheckCircle, Clock, XCircle, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/components/AdminLayout';
import { useNavigate } from 'react-router-dom';

const stats = [
  { title: 'Total Claims', value: '156', icon: FileText, trend: '+12 this week', color: 'primary' },
  { title: 'Approved', value: '89', icon: CheckCircle, trend: '+5 today', color: 'success' },
  { title: 'Pending', value: '42', icon: Clock, trend: '8 urgent', color: 'warning' },
  { title: 'Rejected', value: '25', icon: XCircle, trend: '-3 vs last week', color: 'destructive' },
];

const recentClaims = [
  { id: 'CLM-156', customer: 'Alice Wanjiku', type: 'Funeral Expenses', amount: 'KSH 250,000', status: 'Pending', date: '2024-01-25' },
  { id: 'CLM-155', customer: 'James Odhiambo', type: 'Loan Guard', amount: 'KSH 500,000', status: 'Approved', date: '2024-01-24' },
  { id: 'CLM-154', customer: 'Mary Muthoni', type: 'Disability', amount: 'KSH 180,000', status: 'Under Review', date: '2024-01-24' },
  { id: 'CLM-153', customer: 'Peter Kamau', type: 'Funeral Expenses', amount: 'KSH 120,000', status: 'Pending', date: '2024-01-23' },
  { id: 'CLM-152', customer: 'Grace Akinyi', type: 'Loan Guard', amount: 'KSH 350,000', status: 'Rejected', date: '2024-01-22' },
];

const statusColors: Record<string, string> = {
  Approved: 'bg-success/10 text-success',
  Pending: 'bg-warning/10 text-warning',
  'Under Review': 'bg-info/10 text-info',
  Rejected: 'bg-destructive/10 text-destructive',
};

const ManagerDashboard = () => {
  const navigate = useNavigate();

  return (
    <AdminLayout role="manager">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Manager Dashboard</h1>
            <p className="text-muted-foreground">Overview of all insurance claims and activities</p>
          </div>
          <Button onClick={() => navigate('/novaportal/manager/claims')}>
            View All Claims
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Claims */}
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Claims</CardTitle>
              <CardDescription>Latest submitted claims requiring attention</CardDescription>
            </div>
            <Button variant="outline" onClick={() => navigate('/novaportal/manager/claims')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Claim ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Customer</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClaims.map((claim) => (
                    <tr key={claim.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{claim.id}</td>
                      <td className="py-3 px-4">{claim.customer}</td>
                      <td className="py-3 px-4">{claim.type}</td>
                      <td className="py-3 px-4 font-semibold">{claim.amount}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[claim.status]}`}>
                          {claim.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{claim.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-0 shadow-card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/novaportal/manager/analytics')}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">View Analytics</h3>
                <p className="text-sm text-muted-foreground">Charts and insights on claims data</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/novaportal/manager/settings')}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-info" />
              </div>
              <div>
                <h3 className="font-semibold">Manage Officers</h3>
                <p className="text-sm text-muted-foreground">Assign roles and manage team</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ManagerDashboard;
