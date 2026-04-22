import { FileText, CheckCircle, Clock, XCircle, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/components/AdminLayout';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const statusColors: Record<string, string> = {
  Approved: 'bg-success/10 text-success',
  Pending: 'bg-warning/10 text-warning',
  'Under Review': 'bg-info/10 text-info',
  Rejected: 'bg-destructive/10 text-destructive',
};

const PAGE_SIZE = 5;

const ManagerDashboard = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState<any[]>([]);
  const [recentClaims, setRecentClaims] = useState<any[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchDashboardData(page);
  }, [page]);

  const formatStatus = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'pending':
        return 'Pending';
      case 'rejected':
        return 'Rejected';
      case 'under_review':
        return 'Under Review';
      default:
        return status;
    }
  };

  const fetchDashboardData = async (currentPage: number) => {
    try {
      // PAGINATED QUERY
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: claims, error, count } = await supabase
        .from('claims')
       .select(`
  *,
  userprofile!claims_user_id_fkey(username,email)
`, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // STATS (still global, not paginated)
      const { data: allClaims } = await supabase
        .from('claims')
        .select('claim_status');

      const total = allClaims?.length || 0;
      const approved = allClaims?.filter(c => c.claim_status === 'approved').length || 0;
      const pending = allClaims?.filter(c => c.claim_status === 'pending').length || 0;
      const rejected = allClaims?.filter(c => c.claim_status === 'rejected').length || 0;

      setStats([
        {
          title: 'Total Claims',
          value: total,
          icon: FileText,
          trend: '',
          color: 'primary',
        },
        {
          title: 'Approved',
          value: approved,
          icon: CheckCircle,
          trend: '',
          color: 'success',
        },
        {
          title: 'Pending',
          value: pending,
          icon: Clock,
          trend: '',
          color: 'warning',
        },
        {
          title: 'Rejected',
          value: rejected,
          icon: XCircle,
          trend: '',
          color: 'destructive',
        },
      ]);

      // FORMAT (UNCHANGED STRUCTURE)
      const formatted = claims.map((c) => ({
        id: c.claim_number,
        customer: c.userprofile?.username || 'Unknown',
        type: c.claim_reason,
        amount: `KSH ${Number(c.claim_amount).toLocaleString()}`,
        status: formatStatus(c.claim_status),
        date: new Date(c.created_at).toISOString().split('T')[0],
      }));

      setRecentClaims(formatted);

      // store total pages if needed later
      setTotalPages(Math.ceil((count || 0) / PAGE_SIZE));

    } catch (err) {
      console.error('Dashboard error:', err);
    }
  };

  const [totalPages, setTotalPages] = useState(1);

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

            {/* Pagination Controls (minimal, no UI disruption) */}
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(prev => prev - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === totalPages}
                onClick={() => setPage(prev => prev + 1)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card
            className="border-0 shadow-card hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/novaportal/manager/analytics')}
          >
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

          <Card
            className="border-0 shadow-card hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/novaportal/manager/settings')}
          >
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