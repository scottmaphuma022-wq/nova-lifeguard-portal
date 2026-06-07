import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import AdminLayout from '@/components/AdminLayout';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const claimsByType = [
  { name: 'Funeral', value: 45, color: 'hsl(var(--chart-1))' },
  { name: 'Loan Guard', value: 35, color: 'hsl(var(--chart-2))' },
  { name: 'Disability', value: 20, color: 'hsl(var(--chart-3))' },
];

const claimsByMonth = [
  { month: 'Aug', claims: 24, approved: 18, rejected: 4 },
  { month: 'Sep', claims: 32, approved: 25, rejected: 5 },
  { month: 'Oct', claims: 28, approved: 20, rejected: 6 },
  { month: 'Nov', claims: 35, approved: 28, rejected: 4 },
  { month: 'Dec', claims: 42, approved: 35, rejected: 5 },
  { month: 'Jan', claims: 38, approved: 30, rejected: 6 },
];

const customerActivity = [
  { month: 'Aug', newCustomers: 45, activeClaims: 24 },
  { month: 'Sep', newCustomers: 52, activeClaims: 32 },
  { month: 'Oct', newCustomers: 48, activeClaims: 28 },
  { month: 'Nov', newCustomers: 62, activeClaims: 35 },
  { month: 'Dec', newCustomers: 58, activeClaims: 42 },
  { month: 'Jan', newCustomers: 71, activeClaims: 38 },
];

const ManagerAnalytics = () => {
  const { toast } = useToast();

  const handleExportExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Summary Metrics
    csvContent += "SUMMARY METRICS\n";
    csvContent += "Metric,Value,Trend\n";
    csvContent += "Total Claims (6mo),199,+23% vs last period\n";
    csvContent += "Avg. Processing Time,4.2 days,-12% vs last period\n";
    csvContent += "Approval Rate,78%,+5% vs last period\n";
    csvContent += "Total Paid Out,KSH 12.5M,+18% vs last period\n\n";

    // Claims by Type
    csvContent += "CLAIMS BY INSURANCE TYPE\n";
    csvContent += "Type,Count\n";
    claimsByType.forEach(c => {
      csvContent += `${c.name},${c.value}\n`;
    });
    csvContent += "\n";

    // Monthly Claims
    csvContent += "MONTHLY CLAIMS TREND\n";
    csvContent += "Month,Total Claims,Approved Claims,Rejected Claims\n";
    claimsByMonth.forEach(c => {
      csvContent += `${c.month},${c.claims},${c.approved},${c.rejected}\n`;
    });
    csvContent += "\n";

    // Customer Activity
    csvContent += "CUSTOMER GROWTH & ACTIVITY\n";
    csvContent += "Month,New Customers,Active Claims\n";
    customerActivity.forEach(c => {
      csvContent += `${c.month},${c.newCustomers},${c.activeClaims}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "nova_insurance_analytics_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: 'Report Exported Successfully',
      description: 'Analytics data has been exported to an Excel-compatible CSV file.',
    });
  };

  return (
    <AdminLayout role="manager">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Insights and trends from claims data</p>
          </div>
          <Button onClick={handleExportExcel} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Total Claims (6mo)', value: '199', change: '+23%' },
            { label: 'Avg. Processing Time', value: '4.2 days', change: '-12%' },
            { label: 'Approval Rate', value: '78%', change: '+5%' },
            { label: 'Total Paid Out', value: 'KSH 12.5M', change: '+18%' },
          ].map((stat) => (
            <Card key={stat.label} className="border-0 shadow-card">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-success">{stat.change} vs last period</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Claims by Type Pie Chart */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>Claims by Type</CardTitle>
              <CardDescription>Distribution of claim types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={claimsByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {claimsByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Claims Trend Bar Chart */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>Monthly Claims</CardTitle>
              <CardDescription>Claims submitted vs approved vs rejected</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={claimsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-muted-foreground" />
                    <YAxis className="text-muted-foreground" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="claims" name="Total" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="approved" name="Approved" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="rejected" name="Rejected" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Activity Line Chart */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Customer Activity</CardTitle>
            <CardDescription>New customers and active claims over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={customerActivity}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-muted-foreground" />
                  <YAxis className="text-muted-foreground" />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="newCustomers" 
                    name="New Customers" 
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-1))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="activeClaims" 
                    name="Active Claims" 
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-3))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ManagerAnalytics;
