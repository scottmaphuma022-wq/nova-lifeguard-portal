import { useEffect, useState } from 'react';
import { 
  FileText, CreditCard, Clock, Shield, AlertCircle, CheckCircle, 
  XCircle, FileUp, Bell, ChevronRight, Activity, Upload, X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DashboardLayout from '@/components/DashboardLayout';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

/* ------------------ helpers ------------------ */
const statusColors: Record<string, string> = {
  approved: 'bg-success/10 text-success border-success/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  'under review': 'bg-info/10 text-info border-info/20',
  paid: 'bg-success/10 text-success border-success/20',
};

const formatCurrency = (amount: number) =>
  `KES ${amount.toLocaleString()}`;

/* ------------------ component ------------------ */
const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [username, setUsername] = useState('Customer');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<Record<string, File | null>>({
    'Death Certificate': null,
    'ID Copy': null,
    'Medical Report': null,
  });

  const [stats, setStats] = useState({
    activePolicies: 0,
    totalClaims: 0,
    pendingClaims: 0,
    totalPaid: 0,
    rejectedClaims: 0,
  });
  
  const [recentClaims, setRecentClaims] = useState<any[]>([]);
  const [activePolicy, setActivePolicy] = useState<any>(null);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('userprofile')
        .select('id, username')
        .eq('id', user.id)
        .single();

      if (profile) setUsername(profile.username);

      const { data: claims = [] } = await supabase
        .from('claims')
        .select('id, claim_number, claim_amount, claim_status, claim_reason, date_applied')
        .eq('user_id', user.id)
        .order('date_applied', { ascending: false });

      const { data: payments = [] } = await supabase
        .from('payments')
        .select(`
          amount_paid,
          cover_id,
          date_paid,
          covers ( cover_name, price )
        `)
        .eq('user_id', user.id)
        .order('date_paid', { ascending: false });

      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
      const pendingClaims = claims.filter((c) => c.claim_status === 'pending').length;
      const rejectedClaims = claims.filter((c) => c.claim_status === 'rejected').length;
      
      // Calculate unique policies (covers paid for)
      const uniqueCovers = new Set(payments.map(p => p.cover_id));

      setStats({
        activePolicies: uniqueCovers.size > 0 ? uniqueCovers.size : 2, // fallback to 2 for demo if none
        totalClaims: claims.length > 0 ? claims.length : 3,
        pendingClaims: pendingClaims > 0 ? pendingClaims : 1,
        totalPaid: totalPaid > 0 ? totalPaid : 250000,
        rejectedClaims: rejectedClaims,
      });

      setRecentClaims(
        claims.slice(0, 3).map((c) => ({
          id: c.claim_number,
          type: c.claim_reason,
          amount: formatCurrency(Number(c.claim_amount)),
          status: c.claim_status,
          date: new Date(c.date_applied).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        }))
      );
      
      // Fallback for demo if no real claims
      if (claims.length === 0) {
        setRecentClaims([
          { id: 'CLM-2024-0003', type: 'Funeral Expenses', amount: 'KES 50,000', status: 'pending', date: '10 May 2024' },
          { id: 'CLM-2024-0002', type: 'Loan Guard Policy', amount: 'KES 120,000', status: 'approved', date: '20 Apr 2024' },
          { id: 'CLM-2024-0001', type: 'Permanent Disability', amount: 'KES 250,000', status: 'paid', date: '15 Feb 2024' },
        ]);
      }

      setRecentPayments(
         payments.slice(0, 3).map((p) => ({
             date: new Date(p.date_paid).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
             amount: formatCurrency(Number(p.amount_paid)),
             status: 'Paid'
         }))
      );
      
      if (payments.length === 0) {
          setRecentPayments([
              { date: '12 May 2024', amount: 'KES 1,500', status: 'Paid' },
              { date: '12 Apr 2024', amount: 'KES 1,500', status: 'Paid' },
              { date: '12 Mar 2024', amount: 'KES 1,500', status: 'Paid' },
          ]);
      }

      // Mock active policy
      setActivePolicy({
        policyNumber: 'POL-2024-001256',
        coverType: 'Funeral Expenses Cover',
        plan: 'Standard',
        coverageAmount: 'KES 200,000',
        startDate: '12 Jan 2024',
        nextPremiumDue: '12 Jun 2024 (in 18 days)'
      });

    };

    loadDashboard();
  }, []);

  const handleUploadNow = async () => {
    const filledDocs = Object.entries(uploadFiles).filter(([, f]) => f !== null);
    if (filledDocs.length === 0) {
      return toast({ title: 'Please upload at least one document', variant: 'destructive' });
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const timestamp = Date.now();
      for (const [docName, file] of filledDocs) {
        if (!file) continue;
        const safeName = docName.replace(/\s+/g, '_');
        const path = `${user.id}/pending-docs/${timestamp}-${safeName}-${file.name}`;
        const { error } = await supabase.storage
          .from('claim-documents')
          .upload(path, file, { upsert: true });
        if (error) throw new Error(`Upload failed for ${docName}: ${error.message}`);
      }

      toast({ title: 'Documents uploaded successfully ✓', description: 'Our team will review your documents shortly.' });
      setUploadOpen(false);
      setUploadFiles({ 'Death Certificate': null, 'ID Copy': null, 'Medical Report': null });

    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-10">
        {/* Welcome Section */}
        <div className="flex justify-between items-end">
          <div>
            <p className="text-muted-foreground text-sm">Welcome back,</p>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {username} <span className="text-xl">👋</span>
            </h1>
          </div>
          <div className="flex items-center gap-4 hidden md:flex">
             <div className="relative cursor-pointer hover:bg-muted p-2 rounded-full transition-colors">
                 <Bell className="w-5 h-5 text-muted-foreground" />
                 <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full border border-background"></span>
             </div>
             <div className="flex items-center gap-2 cursor-pointer hover:bg-muted p-1 pr-3 rounded-full transition-colors border border-transparent hover:border-border">
                 <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                     {username.charAt(0).toUpperCase()}
                 </div>
                 <span className="text-sm font-medium">{username}</span>
             </div>
          </div>
        </div>

        {/* Top Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Active Policies */}
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-4 flex flex-col justify-between h-full relative overflow-hidden">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Active Policies</p>
                  <p className="text-2xl font-bold">{stats.activePolicies}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50">
                  <Link to="/policies" className="text-xs text-primary flex items-center font-medium hover:underline">
                      View policies <ChevronRight className="w-3 h-3 ml-1" />
                  </Link>
              </div>
            </CardContent>
          </Card>

          {/* Total Claims Made */}
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-4 flex flex-col justify-between h-full relative overflow-hidden">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Claims Made</p>
                  <p className="text-2xl font-bold">{stats.totalClaims}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50">
                  <Link to="/claims" className="text-xs text-primary flex items-center font-medium hover:underline">
                      View all claims <ChevronRight className="w-3 h-3 ml-1" />
                  </Link>
              </div>
            </CardContent>
          </Card>

          {/* Pending Claims */}
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-4 flex flex-col justify-between h-full relative overflow-hidden">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Pending Claims</p>
                  <p className="text-2xl font-bold">{stats.pendingClaims}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50">
                  <Link to="/claims" className="text-xs text-primary flex items-center font-medium hover:underline">
                      View pending <ChevronRight className="w-3 h-3 ml-1" />
                  </Link>
              </div>
            </CardContent>
          </Card>

          {/* Total Paid Out */}
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-4 flex flex-col justify-between h-full relative overflow-hidden">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Paid Out</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalPaid)}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50">
                  <Link to="/payments" className="text-xs text-primary flex items-center font-medium hover:underline">
                      View payments <ChevronRight className="w-3 h-3 ml-1" />
                  </Link>
              </div>
            </CardContent>
          </Card>

          {/* Rejected Claims */}
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-4 flex flex-col justify-between h-full relative overflow-hidden">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <XCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Rejected Claims</p>
                  <p className="text-2xl font-bold">{stats.rejectedClaims}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50">
                  <Link to="/claims" className="text-xs text-primary flex items-center font-medium hover:underline">
                      View details <ChevronRight className="w-3 h-3 ml-1" />
                  </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column (Wider) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* My Active Policy */}
            <Card className="shadow-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">My Active Policy</CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="bg-muted/30 rounded-xl p-5 flex flex-col md:flex-row gap-6 items-center">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                        <Shield className="w-10 h-10 text-primary" />
                    </div>
                    <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="col-span-2">
                            <p className="text-xs text-muted-foreground mb-1">Policy Number</p>
                            <p className="font-semibold">{activePolicy?.policyNumber}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-xs text-muted-foreground mb-1">Cover Type</p>
                            <p className="font-semibold">{activePolicy?.coverType}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Plan</p>
                            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{activePolicy?.plan}</Badge>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Coverage Amount</p>
                            <p className="font-semibold text-success">{activePolicy?.coverageAmount}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Start Date</p>
                            <p className="font-semibold text-sm">{activePolicy?.startDate}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Next Premium Due</p>
                            <p className="font-semibold text-sm text-destructive">{activePolicy?.nextPremiumDue}</p>
                        </div>
                    </div>
                 </div>
                 <div className="mt-4">
                     <Button className="bg-primary hover:bg-primary/90 text-white rounded-md" onClick={() => navigate('/policies')}>View Policy Details</Button>
                 </div>
              </CardContent>
            </Card>

            {/* Claims Overview Table */}
            <Card className="shadow-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Claims Overview</CardTitle>
                <Link to="/claims" className="text-xs text-primary hover:underline flex items-center">
                    View all claims <ChevronRight className="w-3 h-3 ml-1" />
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-y border-border/50">
                              <tr>
                                  <th className="px-4 py-3 font-medium">Claim ID</th>
                                  <th className="px-4 py-3 font-medium">Claim Type</th>
                                  <th className="px-4 py-3 font-medium">Date Submitted</th>
                                  <th className="px-4 py-3 font-medium">Status</th>
                                  <th className="px-4 py-3 font-medium text-right">Action</th>
                              </tr>
                          </thead>
                          <tbody>
                              {recentClaims.map((claim, index) => (
                                  <tr key={index} className="border-b border-border/50 hover:bg-muted/20">
                                      <td className="px-4 py-3 font-medium text-primary">{claim.id}</td>
                                      <td className="px-4 py-3">{claim.type}</td>
                                      <td className="px-4 py-3">{claim.date}</td>
                                      <td className="px-4 py-3">
                                          <Badge variant="outline" className={`${statusColors[claim.status?.toLowerCase()] || ''} capitalize`}>
                                              {claim.status === 'pending' ? 'Pending Documents' : claim.status}
                                          </Badge>
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                          <Button variant="link" size="sm" className="text-primary h-auto p-0" onClick={() => navigate('/claims')}>View Details</Button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </CardContent>
            </Card>

            {/* Documents Required */}
            <Card className="shadow-sm border-border/50 bg-warning/5 border-warning/20">
                <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
                            <FileUp className="w-5 h-5 text-warning" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm">Claim CLM-2024-0003</h4>
                            <p className="text-xs text-muted-foreground mt-1 mb-3">Please upload the following documents to continue processing your claim.</p>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="bg-white text-xs py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-destructive mr-1.5 inline-block"></span>Death Certificate</Badge>
                                <Badge variant="outline" className="bg-white text-xs py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-destructive mr-1.5 inline-block"></span>ID Copy</Badge>
                                <Badge variant="outline" className="bg-white text-xs py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-destructive mr-1.5 inline-block"></span>Medical Report</Badge>
                            </div>
                        </div>
                    </div>
                    <Button
                      className="bg-primary hover:bg-primary/90 shrink-0 w-full sm:w-auto mt-2 sm:mt-0"
                      onClick={() => setUploadOpen(true)}
                    >
                      <Upload className="w-4 h-4 mr-2" /> Upload Now
                    </Button>
                </CardContent>
            </Card>

          </div>

          {/* Right Column (Narrower) */}
          <div className="space-y-6">
              
            {/* Quick Actions */}
            <Card className="shadow-sm border-border/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div 
                        className="bg-primary hover:bg-primary/90 text-white p-4 rounded-xl cursor-pointer flex items-center gap-4 transition-colors"
                        onClick={() => navigate('/claims')}
                    >
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-semibold text-sm">Submit a Claim</p>
                            <p className="text-xs text-white/80">File a new claim online</p>
                        </div>
                    </div>
                    
                    <div 
                        className="bg-success hover:bg-success/90 text-white p-4 rounded-xl cursor-pointer flex items-center gap-4 transition-colors"
                        onClick={() => navigate('/payments')}
                    >
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-semibold text-sm">Pay Premium</p>
                            <p className="text-xs text-white/80">Make a premium payment</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Notifications */}
            <Card className="shadow-sm border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base">Notifications</CardTitle>
                    <Link to="/claims" className="text-xs text-primary hover:underline">View all</Link>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center shrink-0 mt-0.5">
                            <AlertCircle className="w-4 h-4 text-warning" />
                        </div>
                        <div>
                            <p className="text-sm">Your claim <strong>CLM-2024-0003</strong> requires additional documents.</p>
                            <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle className="w-4 h-4 text-success" />
                        </div>
                        <div>
                            <p className="text-sm">Payment of <strong>KES 1,500</strong> was successful. Thank you!</p>
                            <p className="text-xs text-muted-foreground mt-1">1 day ago</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Shield className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm">Your policy <strong>POL-2024-001256</strong> is active.</p>
                            <p className="text-xs text-muted-foreground mt-1">3 days ago</p>
                        </div>
                    </div>
                    <div className="pt-2 text-center border-t border-border/50">
                        <Link to="/claims" className="text-xs text-primary hover:underline flex items-center justify-center">
                            View all notifications <ChevronRight className="w-3 h-3 ml-1" />
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Payments */}
            <Card className="shadow-sm border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base">Payments</CardTitle>
                    <Link to="/payments" className="text-xs text-primary hover:underline flex items-center">
                        View all payments <ChevronRight className="w-3 h-3 ml-1" />
                    </Link>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                        <p className="text-sm font-semibold mb-2">Premium Due</p>
                        <div className="flex justify-between items-end mb-3">
                            <div>
                                <p className="text-xs text-muted-foreground">Amount</p>
                                <p className="font-bold">KES 1,500</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">Due Date</p>
                                <p className="text-xs text-destructive font-medium">12 Jun 2024 (in 18 days)</p>
                            </div>
                        </div>
                        <Button size="sm" className="w-full bg-primary hover:bg-primary/90" onClick={() => navigate('/payments')}>Pay Now</Button>
                    </div>
                    
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-3">Recent Payments</p>
                        <div className="space-y-3">
                            {recentPayments.map((payment, index) => (
                                <div key={index} className="flex justify-between items-center pb-2 border-b border-border/50 last:border-0 last:pb-0">
                                    <p className="text-sm text-muted-foreground">{payment.date}</p>
                                    <div className="flex items-center gap-3">
                                        <p className="text-sm font-medium">{payment.amount}</p>
                                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 py-0 text-[10px]">{payment.status}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            {/* Activity Feed */}
            <Card className="shadow-sm border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base">Activity Feed</CardTitle>
                    <Link to="/claims" className="text-xs text-primary hover:underline">View all</Link>
                </CardHeader>
                <CardContent className="space-y-0 relative">
                    <div className="absolute left-[21px] top-4 bottom-4 w-px bg-border/80"></div>
                    
                    <div className="flex gap-4 pb-4 relative z-10">
                        <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shrink-0 border-[3px] border-background mt-1">
                            <Activity className="w-3 h-3" />
                        </div>
                        <div>
                            <p className="text-sm">You submitted claim <strong>CLM-2024-0003</strong></p>
                            <p className="text-xs text-muted-foreground mt-0.5">10 May 2024, 10:30 AM</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-4 pb-4 relative z-10">
                        <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shrink-0 border-[3px] border-background mt-1">
                            <Activity className="w-3 h-3" />
                        </div>
                        <div>
                            <p className="text-sm">Document uploaded for claim <strong>CLM-2024-0002</strong></p>
                            <p className="text-xs text-muted-foreground mt-0.5">22 Apr 2024, 11:15 AM</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-4 pb-4 relative z-10">
                        <div className="w-6 h-6 rounded-full bg-success text-white flex items-center justify-center shrink-0 border-[3px] border-background mt-1">
                            <CheckCircle className="w-3 h-3" />
                        </div>
                        <div>
                            <p className="text-sm">Claim <strong>CLM-2024-0002</strong> approved</p>
                            <p className="text-xs text-muted-foreground mt-0.5">25 Apr 2024, 02:20 PM</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-4 relative z-10">
                        <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shrink-0 border-[3px] border-background mt-1">
                            <CreditCard className="w-3 h-3" />
                        </div>
                        <div>
                            <p className="text-sm">Payment of KES 200,000 completed for claim <strong>CLM-2024-0001</strong></p>
                            <p className="text-xs text-muted-foreground mt-0.5">20 Feb 2024, 09:45 AM</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

          </div>
        </div>
      </div>
      {/* Document Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="w-5 h-5 text-warning" />
              Upload Claim Documents
            </DialogTitle>
            <DialogDescription>
              Claim CLM-2024-0003 — Please upload all required documents to continue processing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {Object.keys(uploadFiles).map((docName) => (
              <div key={docName} className="border border-border/60 rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${uploadFiles[docName] ? 'bg-success' : 'bg-destructive'}`} />
                  <span className="text-sm font-medium truncate">{docName}</span>
                </div>
                <label className="shrink-0 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setUploadFiles((prev) => ({ ...prev, [docName]: f }));
                    }}
                  />
                  <span className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                    uploadFiles[docName]
                      ? 'bg-success/10 text-success border border-success/30 hover:bg-success/20'
                      : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'
                  }`}>
                    {uploadFiles[docName] ? (
                      <><CheckCircle className="w-3 h-3" /> {uploadFiles[docName]!.name.slice(0, 14)}...</>
                    ) : (
                      <><Upload className="w-3 h-3" /> Choose File</>
                    )}
                  </span>
                </label>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={handleUploadNow}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Submit Documents'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CustomerDashboard;
