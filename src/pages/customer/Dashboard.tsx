import { useEffect, useState } from 'react';
import { FileText, CreditCard, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import DashboardLayout from '@/components/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

/* ------------------ helpers ------------------ */
const statusColors: Record<string, string> = {
  approved: 'bg-success/10 text-success',
  pending: 'bg-warning/10 text-warning',
  rejected: 'bg-destructive/10 text-destructive',
  'under review': 'bg-info/10 text-info',
};

const formatCurrency = (amount: number) =>
  `KSH ${amount.toLocaleString()}`;

/* ------------------ component ------------------ */
const CustomerDashboard = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState('Customer');
  const [stats, setStats] = useState<any[]>([]);
  const [recentClaims, setRecentClaims] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<any[]>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      /* 1️⃣ Get logged-in user */
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      /* 2️⃣ Fetch user profile */
      const { data: profile } = await supabase
        .from('userprofile')
        .select('id, username')
        .eq('id', user.id)
        .single();

      if (profile) setUsername(profile.username);

      /* 3️⃣ Fetch claims */
      const { data: claims = [] } = await supabase
        .from('claims')
        .select('id, claim_number, claim_amount, claim_status, claim_reason, date_applied')
        .eq('user_id', user.id)
        .order('date_applied', { ascending: false });

      /* 4️⃣ Fetch payments + covers */
      const { data: payments = [] } = await supabase
        .from('payments')
        .select(`
          amount_paid,
          cover_id,
          covers ( cover_name, price )
        `)
        .eq('user_id', user.id);

      /* ------------------ stats ------------------ */
      const totalPaid = payments.reduce(
        (sum, p) => sum + Number(p.amount_paid),
        0
      );

      const pendingClaims = claims.filter(
        (c) => c.claim_status === 'pending'
      ).length;

      setStats([
        {
          title: 'Total Claims',
          value: claims.length.toString(),
          description: 'Claims submitted',
          icon: FileText,
          trend: `+${claims.length} total`,
          color: 'primary',
        },
        {
          title: 'Total Paid',
          value: formatCurrency(totalPaid),
          description: 'Premiums paid',
          icon: CreditCard,
          trend: 'On track',
          color: 'success',
        },
        {
          title: 'Pending Claims',
          value: pendingClaims.toString(),
          description: 'Awaiting review',
          icon: Clock,
          trend: 'Under review',
          color: 'warning',
        },
      ]);

      /* ------------------ recent claims ------------------ */
      setRecentClaims(
        claims.slice(0, 3).map((c) => ({
          id: c.claim_number,
          type: c.claim_reason,
          amount: formatCurrency(Number(c.claim_amount)),
          status: c.claim_status,
          date: new Date(c.date_applied).toISOString().split('T')[0],
        }))
      );

      /* ------------------ coverage progress ------------------ */
      const coverMap: Record<string, any> = {};

      payments.forEach((p: any) => {
        const cover = p.covers;
        if (!cover) return;

        if (!coverMap[cover.cover_name]) {
          coverMap[cover.cover_name] = {
            name: cover.cover_name,
            used: 0,
            total: Number(cover.price),
          };
        }

        coverMap[cover.cover_name].used += Number(p.amount_paid);
      });

      setCoverage(Object.values(coverMap));
    };

    loadDashboard();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">
            Welcome back, {username}!
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your insurance account.
          </p>
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
                  <stat.icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.trend}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Coverage Progress */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Your Coverage</CardTitle>
            <CardDescription>
              Active insurance plans and utilization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {coverage.map((c: any) => {
              const percent = Math.min(
                Math.round((c.used / c.total) * 100),
                100
              );

              return (
                <div key={c.name}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(c.used)} / {formatCurrency(c.total)}
                    </span>
                  </div>
                  <Progress value={percent} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Claims */}
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Claims</CardTitle>
              <CardDescription>
                Your latest claim submissions
              </CardDescription>
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
                      <p className="text-sm text-muted-foreground">
                        {claim.id} • {claim.date}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{claim.amount}</p>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        statusColors[claim.status]
                      }`}
                    >
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
          <Card
            className="border-0 shadow-card hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/claims')}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Submit a Claim</h3>
                <p className="text-sm text-muted-foreground">
                  File a new insurance claim
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="border-0 shadow-card hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/payments')}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Make a Payment</h3>
                <p className="text-sm text-muted-foreground">
                  Pay your insurance premium
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CustomerDashboard;
