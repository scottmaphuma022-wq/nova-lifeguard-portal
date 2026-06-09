import { useEffect, useState, useCallback } from 'react';
import { 
  FileText, CreditCard, Clock, Shield, AlertCircle, CheckCircle, Info,
  XCircle, FileUp, ChevronRight, Upload, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import DiditVerificationModal from '@/components/DiditVerificationModal';

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
  const [uploadOpen, setUploadOpen] = useState<{ claimId: string; claimType: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  // Single file for the claim-specific document
  const [claimFile, setClaimFile] = useState<File | null>(null);
  // Only shown when not verified — an ID copy
  const [idFile, setIdFile] = useState<File | null>(null);

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

  /* ── Notifications (live from Supabase) ── */
  type NotifType = 'info' | 'success' | 'warning' | 'error';
  interface Notification { id: string; title: string; body: string; type: NotifType; read: boolean; created_at: string; }
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notifStyle: Record<NotifType, { icon: React.ElementType; color: string; bg: string }> = {
    info:    { icon: Info,         color: 'text-primary',     bg: 'bg-primary/10'     },
    success: { icon: CheckCircle,  color: 'text-success',     bg: 'bg-success/10'     },
    warning: { icon: AlertCircle,  color: 'text-warning',     bg: 'bg-warning/10'     },
    error:   { icon: AlertCircle,  color: 'text-destructive', bg: 'bg-destructive/10' },
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)   return 'Just now';
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const loadNotifications = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, type, read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setNotifications(data as Notification[]);
  }, []);

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load notifications in parallel
      loadNotifications(user.id);

      const { data: profile } = await supabase
        .from('userprofile')
        .select('id, username, kyc_status')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUsername(profile.username);
        setKycStatus(profile.kyc_status ?? null);
      }

      const { data: claimsData } = await supabase
        .from('claims')
        .select('id, claim_number, claim_amount, claim_status, claim_reason, date_applied')
        .eq('user_id', user.id)
        .order('date_applied', { ascending: false });

      const claimsList = claimsData || [];

      const { data: paymentsData } = await supabase
        .from('payments')
        .select(`
          amount_paid,
          cover_id,
          payment_date,
          plan_tier,
          payment_status,
          cover:cover_id ( id, cover_name, price )
        `)
        .eq('user_id', user.id)
        .eq('payment_status', 'completed')
        .order('payment_date', { ascending: false });

      const paymentsList = paymentsData || [];

      const totalPaid = paymentsList.reduce((sum, p: any) => sum + Number(p.amount_paid), 0);
      const pendingClaims = claimsList.filter((c) => c.claim_status === 'pending').length;
      const rejectedClaims = claimsList.filter((c) => c.claim_status === 'rejected').length;
      
      // Calculate unique policies (covers paid for)
      const uniqueCovers = new Set(paymentsList.map((p: any) => p.cover_id));

      setStats({
        activePolicies: uniqueCovers.size,
        totalClaims: claimsList.length,
        pendingClaims,
        totalPaid,
        rejectedClaims,
      });

      setRecentClaims(
        claimsList.slice(0, 3).map((c) => ({
          id: c.claim_number,
          type: c.claim_reason,
          amount: formatCurrency(Number(c.claim_amount)),
          status: c.claim_status,
          date: new Date(c.date_applied).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        }))
      );

      setRecentPayments(
         paymentsList.slice(0, 3).map((p: any) => ({
             date: new Date(p.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
             amount: formatCurrency(Number(p.amount_paid)),
             status: 'Paid'
         }))
      );

      // Live active policy setting
      if (paymentsList.length > 0) {
        const latest = paymentsList[0];
        setActivePolicy({
          policyNumber: `POL-2024-00${latest.cover?.id || '1256'}`,
          coverType: latest.cover?.cover_name || 'Active Policy',
          plan: latest.plan_tier || 'Standard',
          coverageAmount: formatCurrency(Number(latest.amount_paid) * 125),
          startDate: new Date(latest.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          nextPremiumDue: 'Flexible Premium'
        });
      } else {
        setActivePolicy(null);
      }

    };

    loadDashboard();
  }, [loadNotifications]);

  /* ── Realtime: update notifications live when claims change ── */
  useEffect(() => {
    let userId: string;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      userId = user.id;
      const channel = supabase
        .channel('dashboard-notifications')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => loadNotifications(user.id)
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    });
  }, [loadNotifications]);

  /* Map claim reason → the specific document they need to upload */
  const getClaimDoc = (claimType: string): string => {
    const t = (claimType ?? '').toLowerCase();
    if (t.includes('death'))       return 'Death Certificate';
    if (t.includes('disab'))       return 'Disability Certificate';
    if (t.includes('medical') || t.includes('hospital')) return 'Medical Report';
    if (t.includes('accident'))    return 'Accident Report';
    if (t.includes('funeral'))     return 'Funeral Invoice';
    if (t.includes('repatri'))     return 'Repatriation Documents';
    return 'Supporting Document';
  };

  const handleUploadNow = async () => {
    if (!uploadOpen) return;
    const isVerified = kycStatus === 'approved';
    if (!claimFile && (isVerified || !idFile)) {
      return toast({ title: 'Please upload the required document', variant: 'destructive' });
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ts = Date.now();
      const uploads: [string, File][] = [];
      if (claimFile) uploads.push([getClaimDoc(uploadOpen.claimType), claimFile]);
      if (!isVerified && idFile) uploads.push(['ID Copy', idFile]);

      for (const [docName, file] of uploads) {
        const safeName = docName.replace(/\s+/g, '_');
        const path = `${user.id}/${uploadOpen.claimId}/${ts}-${safeName}-${file.name}`;
        const { error } = await supabase.storage
          .from('claim-documents')
          .upload(path, file, { upsert: true });
        if (error) throw new Error(`Upload failed for ${docName}: ${error.message}`);
      }

      toast({ title: 'Documents submitted ✓', description: 'Our team will review your documents shortly.' });
      setUploadOpen(null);
      setClaimFile(null);
      setIdFile(null);
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
             {/* Duplicated notifications and profile removed to match DashboardLayout */}
          </div>
        </div>

        {/* Verification Banner — only shown when identity is NOT yet approved */}
        {kycStatus !== 'approved' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-warning/30 bg-gradient-to-r from-warning/10 to-warning/5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-warning/15 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {kycStatus === 'pending' ? 'Identity Verification Under Review' : 'Identity Not Verified'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {kycStatus === 'pending'
                    ? `Your documents are being reviewed. No action needed — we'll update your status automatically.`
                    : `Verify your identity to unlock faster claim processing. No additional ID uploads needed once verified.`}
                </p>
              </div>
            </div>
            {kycStatus !== 'pending' && (
              <Button
                id="dashboard-verify-btn"
                size="sm"
                className="shrink-0 gap-1.5 text-xs font-semibold bg-warning hover:bg-warning/90 text-warning-foreground"
                onClick={() => setVerifyOpen(true)}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Verify Identity
              </Button>
            )}
          </div>
        )}

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
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  My Active Policy
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {activePolicy ? (
                  <div className="bg-muted/30 rounded-xl p-5 flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Policy Number</p>
                        <p className="font-semibold text-foreground mt-0.5">{activePolicy.policyNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cover Type</p>
                        <p className="font-semibold text-foreground mt-0.5">{activePolicy.coverType}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Plan Tier</p>
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 mt-0.5 capitalize w-fit">
                          {activePolicy.plan}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Coverage Amount</p>
                        <p className="font-semibold text-success mt-0.5">{activePolicy.coverageAmount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Start Date</p>
                        <p className="font-medium text-foreground mt-0.5">{activePolicy.startDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Next Premium Due</p>
                        <p className="font-medium text-destructive mt-0.5">{activePolicy.nextPremiumDue}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground font-medium">No active policies found</p>
                    <Button size="sm" className="mt-3 bg-primary hover:bg-primary/90" onClick={() => navigate('/policies')}>
                      Get Protected Now
                    </Button>
                  </div>
                )}
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
                                          <Button
                                            variant="link"
                                            size="sm"
                                            className="text-primary h-auto p-0"
                                            onClick={() => {
                                              setClaimFile(null);
                                              setIdFile(null);
                                              setUploadOpen({ claimId: claim.id, claimType: claim.type });
                                            }}
                                          >
                                            Upload Docs
                                          </Button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </CardContent>
            </Card>

            {/* Payments */}
            <Card className="shadow-sm border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
                    <CardTitle className="text-base">Payments & Premium Status</CardTitle>
                    <Link to="/payments" className="text-xs text-primary hover:underline flex items-center">
                        View all payments <ChevronRight className="w-3 h-3 ml-1" />
                    </Link>
                </CardHeader>
                <CardContent className="space-y-6 pt-4">
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-3">Recent Payments</p>
                        {recentPayments.length > 0 ? (
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
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                            <Button size="sm" className="mt-3 bg-primary hover:bg-primary/90" onClick={() => navigate('/payments')}>Make a Payment</Button>
                          </div>
                        )}
                    </div>
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
                    <Link to="/claims" className="text-xs text-primary hover:underline">View claims</Link>
                </CardHeader>
                <CardContent className="space-y-4">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => {
                      const style = notifStyle[notif.type] ?? notifStyle.info;
                      const Icon = style.icon;
                      return (
                        <div key={notif.id} className={`flex items-start gap-3 ${notif.read ? 'opacity-60' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${style.bg}`}>
                            <Icon className={`w-4 h-4 ${style.color}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{notif.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{notif.body}</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo(notif.created_at)}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No notifications yet.</p>
                  )}
                </CardContent>
            </Card>
            
            {/* End of Right Column */}
          </div>
        </div>
      </div>
      {/* Document Upload Dialog — claim-aware, verification-aware */}
      <Dialog open={!!uploadOpen} onOpenChange={(o) => { if (!o) { setUploadOpen(null); setClaimFile(null); setIdFile(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="w-5 h-5 text-warning" />
              Upload Claim Document
            </DialogTitle>
            <DialogDescription>
              {uploadOpen
                ? `Claim ${uploadOpen.claimId} — upload your ${getClaimDoc(uploadOpen.claimType)}`
                : 'Upload the required supporting document.'}
            </DialogDescription>
          </DialogHeader>

          {/* Identity verification status */}
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${
            kycStatus === 'approved' ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              kycStatus === 'approved' ? 'bg-success/15' : 'bg-warning/15'
            }`}>
              {kycStatus === 'approved'
                ? <CheckCircle className="w-4 h-4 text-success" />
                : <ShieldAlert className="w-4 h-4 text-warning" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {kycStatus === 'approved' ? 'Identity Verified ✓' : 'Identity Not Verified'}
              </p>
              <p className="text-xs text-muted-foreground">
                {kycStatus === 'approved'
                  ? 'No ID copy needed — only upload the claim document below.'
                  : 'Verify your identity once to skip ID uploads on all future claims.'}
              </p>
            </div>
            {kycStatus !== 'approved' && (
              <Button
                size="sm" variant="outline"
                className="shrink-0 text-xs gap-1 border-warning/40 text-warning hover:bg-warning/10"
                onClick={() => { setUploadOpen(null); setVerifyOpen(true); }}
              >
                <ShieldCheck className="w-3 h-3" /> Verify
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {/* Claim-specific document — always shown, type-aware */}
            {uploadOpen && (() => {
              const docName = getClaimDoc(uploadOpen.claimType);
              return (
                <div className="border border-border/60 rounded-xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${claimFile ? 'bg-success' : 'bg-muted-foreground/40'}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{docName}</p>
                      <p className="text-xs text-muted-foreground">Required — PDF or image</p>
                    </div>
                  </div>
                  <label className="shrink-0 cursor-pointer">
                    <input type="file" accept="image/*,.pdf" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) setClaimFile(f); }} />
                    <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                      claimFile
                        ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                        : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                    }`}>
                      {claimFile
                        ? <><CheckCircle className="w-3 h-3" /> {claimFile.name.slice(0, 18)}…</>
                        : <><Upload className="w-3 h-3" /> Choose File</>}
                    </span>
                  </label>
                </div>
              );
            })()}

            {/* ID Copy — only when NOT verified */}
            {kycStatus !== 'approved' && (
              <div className="border border-warning/30 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${idFile ? 'bg-success' : 'bg-warning'}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">ID Copy</p>
                    <p className="text-xs text-muted-foreground">Required until you verify your identity</p>
                  </div>
                </div>
                <label className="shrink-0 cursor-pointer">
                  <input type="file" accept="image/*,.pdf" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setIdFile(f); }} />
                  <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                    idFile
                      ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                      : 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20'
                  }`}>
                    {idFile
                      ? <><CheckCircle className="w-3 h-3" /> {idFile.name.slice(0, 18)}…</>
                      : <><Upload className="w-3 h-3" /> Choose File</>}
                  </span>
                </label>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => { setUploadOpen(null); setClaimFile(null); setIdFile(null); }} disabled={uploading}>Cancel</Button>
            <Button className="bg-primary hover:bg-primary/90" onClick={handleUploadNow} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Submit Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Didit Identity Verification Modal */}
      <DiditVerificationModal
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        onVerified={() => {
          setKycStatus('approved');
          toast({ title: 'Identity verified successfully ✓', description: 'You now have full access to all features.' });
        }}
      />
    </DashboardLayout>
  );
};

export default CustomerDashboard;
