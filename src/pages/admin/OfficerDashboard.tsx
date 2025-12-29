import { FileText, CheckCircle, Clock, AlertTriangle, Forward } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/components/AdminLayout';
import { useNavigate } from 'react-router-dom';

const stats = [
  { title: 'Assigned Claims', value: '12', icon: FileText, trend: '+3 new', color: 'primary' },
  { title: 'Pending Review', value: '5', icon: Clock, trend: 'Action needed', color: 'warning' },
  { title: 'Completed', value: '7', icon: CheckCircle, trend: 'This week', color: 'success' },
  { title: 'Missing Docs', value: '2', icon: AlertTriangle, trend: 'Follow up', color: 'destructive' },
];

const assignedClaims = [
  { id: 'CLM-154', customer: 'Mary Muthoni', type: 'Disability', amount: 'KSH 180,000', status: 'Pending Review', priority: 'High' },
  { id: 'CLM-151', customer: 'David Mutua', type: 'Disability', amount: 'KSH 200,000', status: 'Pending Review', priority: 'Medium' },
  { id: 'CLM-149', customer: 'Lucy Wambui', type: 'Funeral Expenses', amount: 'KSH 300,000', status: 'Missing Docs', priority: 'Low' },
  { id: 'CLM-147', customer: 'Samuel Otieno', type: 'Loan Guard', amount: 'KSH 450,000', status: 'Verified', priority: 'High' },
  { id: 'CLM-145', customer: 'Faith Njeri', type: 'Funeral Expenses', amount: 'KSH 180,000', status: 'Verified', priority: 'Medium' },
];

const statusColors: Record<string, string> = {
  'Pending Review': 'bg-warning/10 text-warning',
  'Missing Docs': 'bg-destructive/10 text-destructive',
  'Verified': 'bg-success/10 text-success',
};

const priorityColors: Record<string, string> = {
  High: 'bg-destructive/10 text-destructive',
  Medium: 'bg-warning/10 text-warning',
  Low: 'bg-muted text-muted-foreground',
};

const OfficerDashboard = () => {
  const navigate = useNavigate();

  return (
    <AdminLayout role="officer">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Claims Officer Dashboard</h1>
            <p className="text-muted-foreground">Process and verify assigned insurance claims</p>
          </div>
          <Button onClick={() => navigate('/novaportal/officer/claims')}>
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

        {/* Assigned Claims */}
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Assigned Claims</CardTitle>
              <CardDescription>Claims awaiting your review and verification</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assignedClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{claim.id}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[claim.priority]}`}>
                          {claim.priority}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{claim.customer} • {claim.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">{claim.amount}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[claim.status]}`}>
                        {claim.status}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate('/novaportal/officer/claims')}>
                      Process
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-0 shadow-card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/novaportal/officer/claims')}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Process Claims</h3>
                <p className="text-sm text-muted-foreground">Verify documents and process claims</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/novaportal/officer/payments')}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Process Payments</h3>
                <p className="text-sm text-muted-foreground">B2C payments for approved claims</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default OfficerDashboard;
