import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import AdminLayout from '@/components/AdminLayout';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const ManagerAnalytics = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  // Derived chart data
  const [claimsByType, setClaimsByType]       = useState<{ name: string; value: number; color: string }[]>([]);
  const [claimsByMonth, setClaimsByMonth]     = useState<{ month: string; claims: number; approved: number; rejected: number }[]>([]);
  const [customerActivity, setCustomerActivity] = useState<{ month: string; newCustomers: number; activeClaims: number }[]>([]);

  // Summary card values
  const [totalClaims6mo, setTotalClaims6mo]   = useState(0);
  const [approvalRate, setApprovalRate]       = useState('—');
  const [totalPaidOut, setTotalPaidOut]       = useState('—');
  const [avgProcessing, setAvgProcessing]     = useState('—');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // ── 1. All claims (no limit — analytics needs full set) ──────────────
      const { data: claims } = await supabase
        .from('claims')
        .select('claim_status, claim_reason, claim_amount, date_applied, created_at, updated_at');

      // ── 2. All payments ───────────────────────────────────────────────────
      const { data: payments } = await supabase
        .from('payments')
        .select('amount_paid, payment_date, user_id')
        .eq('payment_status', 'completed');

      if (!claims) return;

      // ── Summary stats ─────────────────────────────────────────────────────
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const recent = claims.filter(c => new Date(c.created_at) >= sixMonthsAgo);
      setTotalClaims6mo(recent.length);

      const approved = claims.filter(c => c.claim_status === 'approved').length;
      const rate = claims.length ? Math.round((approved / claims.length) * 100) : 0;
      setApprovalRate(`${rate}%`);

      const totalPaid = (payments || []).reduce((s, p) => s + Number(p.amount_paid), 0);
      setTotalPaidOut(
        totalPaid >= 1_000_000
          ? `KSH ${(totalPaid / 1_000_000).toFixed(1)}M`
          : `KSH ${totalPaid.toLocaleString()}`
      );

      // Avg processing time: days between created_at and updated_at for approved claims
      const approvedClaims = claims.filter(c => c.claim_status === 'approved' && c.updated_at && c.created_at);
      if (approvedClaims.length) {
        const avgMs = approvedClaims.reduce((s, c) => {
          return s + (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime());
        }, 0) / approvedClaims.length;
        const avgDays = (avgMs / (1000 * 60 * 60 * 24)).toFixed(1);
        setAvgProcessing(`${avgDays} days`);
      } else {
        setAvgProcessing('N/A');
      }

      // ── Claims by type (pie chart) ────────────────────────────────────────
      const typeMap: Record<string, number> = {};
      claims.forEach(c => {
        const t = c.claim_reason || 'Other';
        typeMap[t] = (typeMap[t] || 0) + 1;
      });
      setClaimsByType(
        Object.entries(typeMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, value], i) => ({ name, value, color: CHART_COLORS[i % CHART_COLORS.length] }))
      );

      // ── Claims by month — last 6 months (bar chart) ───────────────────────
      const monthlyMap: Record<string, { claims: number; approved: number; rejected: number }> = {};
      const months: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleString('en-GB', { month: 'short' });
        months.push(key);
        monthlyMap[key] = { claims: 0, approved: 0, rejected: 0 };
      }
      claims.forEach(c => {
        const key = new Date(c.created_at).toLocaleString('en-GB', { month: 'short' });
        if (!monthlyMap[key]) return;
        monthlyMap[key].claims++;
        if (c.claim_status === 'approved') monthlyMap[key].approved++;
        if (c.claim_status === 'rejected') monthlyMap[key].rejected++;
      });
      setClaimsByMonth(months.map(m => ({ month: m, ...monthlyMap[m] })));

      // ── Customer activity — new customers per month ───────────────────────
      const { data: profiles } = await supabase
        .from('userprofile')
        .select('created_at')
        .eq('role', 'customer');

      const custMap: Record<string, number> = {};
      months.forEach(m => (custMap[m] = 0));
      (profiles || []).forEach(p => {
        const key = new Date(p.created_at).toLocaleString('en-GB', { month: 'short' });
        if (custMap[key] !== undefined) custMap[key]++;
      });

      setCustomerActivity(
        months.map(m => ({
          month: m,
          newCustomers: custMap[m] || 0,
          activeClaims: monthlyMap[m]?.claims || 0,
        }))
      );

    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'SUMMARY\nMetric,Value\n';
    csv += `Total Claims (6mo),${totalClaims6mo}\n`;
    csv += `Approval Rate,${approvalRate}\n`;
    csv += `Total Paid Out,${totalPaidOut}\n`;
    csv += `Avg Processing Time,${avgProcessing}\n\n`;

    csv += 'CLAIMS BY TYPE\nType,Count\n';
    claimsByType.forEach(c => { csv += `${c.name},${c.value}\n`; });
    csv += '\n';

    csv += 'MONTHLY CLAIMS\nMonth,Total,Approved,Rejected\n';
    claimsByMonth.forEach(c => { csv += `${c.month},${c.claims},${c.approved},${c.rejected}\n`; });
    csv += '\n';

    csv += 'CUSTOMER ACTIVITY\nMonth,New Customers,Active Claims\n';
    customerActivity.forEach(c => { csv += `${c.month},${c.newCustomers},${c.activeClaims}\n`; });

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', 'nova_analytics_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: 'Report Exported', description: 'Analytics exported as CSV.' });
  };

  return (
    <AdminLayout role="manager">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Live insights from claims and payments data</p>
          </div>
          <Button onClick={handleExport} variant="outline" className="gap-2" disabled={loading}>
            <Download className="h-4 w-4" /> Export Report
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading analytics…</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { label: 'Total Claims (6mo)', value: String(totalClaims6mo) },
                { label: 'Avg. Processing Time', value: avgProcessing },
                { label: 'Approval Rate', value: approvalRate },
                { label: 'Total Paid Out', value: totalPaidOut },
              ].map((stat) => (
                <Card key={stat.label} className="border-0 shadow-card">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Claims by Type */}
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle>Claims by Type</CardTitle>
                  <CardDescription>Distribution across claim categories</CardDescription>
                </CardHeader>
                <CardContent>
                  {claimsByType.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={claimsByType}
                            cx="50%" cy="50%"
                            innerRadius={60} outerRadius={100}
                            paddingAngle={5} dataKey="value"
                          >
                            {claimsByType.map((entry, i) => (
                              <Cell key={`cell-${i}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Monthly Claims */}
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle>Monthly Claims</CardTitle>
                  <CardDescription>Submitted vs approved vs rejected</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={claimsByMonth}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="claims"   name="Total"    fill="hsl(var(--chart-1))" radius={[4,4,0,0]} />
                        <Bar dataKey="approved" name="Approved" fill="hsl(var(--chart-5))" radius={[4,4,0,0]} />
                        <Bar dataKey="rejected" name="Rejected" fill="hsl(var(--destructive))" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Customer Activity */}
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle>Customer Activity</CardTitle>
                <CardDescription>New customers registered vs active claims per month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={customerActivity}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone" dataKey="newCustomers" name="New Customers"
                        stroke="hsl(var(--chart-1))" strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-1))' }}
                      />
                      <Line
                        type="monotone" dataKey="activeClaims" name="Active Claims"
                        stroke="hsl(var(--chart-3))" strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-3))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default ManagerAnalytics;
