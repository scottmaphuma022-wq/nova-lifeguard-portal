import { useEffect, useState } from 'react';
import {
  Shield, CheckCircle, Clock, AlertCircle, ChevronRight,
  Heart, Accessibility, Loader2, CreditCard, Phone
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

/* ─── Helpers ─── */
const iconMap: Record<string, any> = {
  funeral: Heart,
  loan: Shield,
  disability: Accessibility,
};

const normalizePhone = (phone: string) => {
  const cleaned = phone.replace(/\s+/g, '');
  if (cleaned.startsWith('07') || cleaned.startsWith('01')) return `254${cleaned.substring(1)}`;
  if (cleaned.startsWith('254')) return cleaned;
  throw new Error('Invalid phone number format. Use 07XXXXXXXX or 01XXXXXXXX');
};

/* ─── Component ─── */
const CustomerPolicies = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [view, setView] = useState<'list' | 'buy'>('list');
  const [policies, setPolicies] = useState<any[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);

  // Buy policy flow
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<'monthly' | 'annual'>('monthly');
  const [phone, setPhone] = useState('');
  const [paying, setPaying] = useState(false);

  /* ── Load user's existing policies ── */
  const loadPolicies = async () => {
    setLoadingPolicies(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setLoadingPolicies(false);

    const { data: payments } = await supabase
      .from('payments')
      .select(`
        id, amount_paid, payment_date, plan_tier, payment_status,
        cover:cover_id ( id, cover_name, cover_type, price )
      `)
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false });

    if (payments && payments.length > 0) {
      // Map each completed payment to a "policy"
      const mapped = payments.map((p: any, i: number) => ({
        policyNumber: `POL-${new Date(p.payment_date).getFullYear()}-${String(i + 1).padStart(6, '0')}`,
        coverName: p.cover?.cover_name || 'Unknown Cover',
        coverType: p.cover?.cover_type || '',
        plan: p.plan_tier || 'standard',
        price: Number(p.amount_paid),
        startDate: new Date(p.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: 'active',
      }));
      setPolicies(mapped);
    } else {
      setPolicies([]);
    }
    setLoadingPolicies(false);
  };

  /* ── Load covers for buy flow ── */
  const loadPlans = async () => {
    const { data } = await supabase
      .from('covers')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (!data) return;

    const planMap: Record<string, any> = {};
    data.forEach((cover: any) => {
      if (!planMap[cover.cover_type]) {
        planMap[cover.cover_type] = {
          id: cover.cover_type,
          name: cover.cover_type.replace(/_/g, ' ').toUpperCase(),
          icon: iconMap[cover.cover_type] || Shield,
          description: cover.description || '',
          tiers: [],
        };
      }
      planMap[cover.cover_type].tiers.push({
        id: cover.id,
        name: cover.plan_tier,
        coverage: cover.cover_name,
        price: cover.price,
      });
    });

    setPlans(Object.values(planMap));
  };

  useEffect(() => {
    loadPolicies();
    loadPlans();
  }, []);

  /* ── Pay for policy ── */
  const handlePayment = async () => {
    if (!selectedTier || !phone) {
      return toast({ title: 'Missing details', description: 'Select a plan tier and enter your phone number', variant: 'destructive' });
    }

    setPaying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in');

      const normalizedPhone = normalizePhone(phone);
      const tier = plans.flatMap(p => p.tiers).find(t => t.id === selectedTier);
      if (!tier) throw new Error('Invalid plan selected');

      const baseAmount = Number(tier.price);
      const amount = selectedDuration === 'annual' ? baseAmount * 12 * 0.9 : baseAmount; // 10% annual discount

      const res = await fetch('/api/payments/stkpush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalizedPhone,
          amount,
          user_id: user.id,
          cover_id: tier.id,
          plan_tier: tier.name,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Payment initiation failed');

      toast({
        title: 'STK Push Sent 📱',
        description: 'Check your phone and enter your M-Pesa PIN to confirm payment.',
      });

      setPhone('');
    } catch (err: any) {
      toast({ title: 'Payment Failed', description: err.message, variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  const selectedTierDetails = (() => {
    const tier = plans.flatMap(p => p.tiers).find(t => t.id === selectedTier);
    return tier;
  })();

  const totalAmount = selectedTierDetails
    ? selectedDuration === 'annual'
      ? (Number(selectedTierDetails.price) * 12 * 0.9)
      : Number(selectedTierDetails.price)
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-10">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Policies</h1>
            <p className="text-muted-foreground text-sm mt-0.5">View and manage your insurance coverage</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit border border-border/50">
          <button
            onClick={() => setView('list')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${view === 'list' ? 'bg-white shadow-sm text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Shield className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            Active Policies
          </button>
          <button
            onClick={() => setView('buy')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${view === 'buy' ? 'bg-white shadow-sm text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <CreditCard className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            Buy Policy
          </button>
        </div>

        {/* ═══ ACTIVE POLICIES ═══ */}
        {view === 'list' && (
          <>
            {loadingPolicies ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
              </div>
            ) : policies.length === 0 ? (
              /* No policy state — per spec */
              <Card className="shadow-sm border-border/50 bg-muted/20">
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-lg font-semibold">You do not have an active policy yet</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                    Purchase a policy to protect yourself and your family from unexpected events.
                  </p>
                  <Button
                    id="get-policy-btn"
                    className="mt-6 bg-primary hover:bg-primary/90"
                    onClick={() => setView('buy')}
                  >
                    Buy a Policy
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {policies.map((policy, i) => {
                  const Icon = iconMap[policy.coverType] || Shield;
                  return (
                    <Card key={i} className="shadow-sm border-border/50 hover:shadow-md transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{policy.coverName}</p>
                              <p className="text-xs text-muted-foreground">{policy.policyNumber}</p>
                            </div>
                          </div>
                          <Badge className="bg-success/10 text-success border-success/20 capitalize text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" /> Active
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Plan Tier</p>
                            <p className="font-medium capitalize">{policy.plan}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Premium</p>
                            <p className="font-medium">KES {policy.price.toLocaleString()}/mo</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Start Date</p>
                            <p className="font-medium">{policy.startDate}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Status</p>
                            <p className="font-medium text-success">Active</p>
                          </div>
                        </div>

                        <Separator className="my-4" />

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-primary hover:bg-primary/90"
                            onClick={() => navigate('/claims')}
                          >
                            File a Claim
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => navigate('/payments')}
                          >
                            Pay Premium
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══ BUY POLICY ═══ */}
        {view === 'buy' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left — Steps */}
            <div className="lg:col-span-2 space-y-6">

              {/* Step 1: Cover Type */}
              <Card className="shadow-sm border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">1</span>
                    Select Cover Type
                  </CardTitle>
                  <CardDescription>Choose the type of insurance coverage you need</CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={selectedPlan || ''} onValueChange={(v) => { setSelectedPlan(v); setSelectedTier(null); }}>
                    <div className="grid gap-3">
                      {plans.map(plan => (
                        <div key={plan.id}>
                          <RadioGroupItem value={plan.id} id={`plan-${plan.id}`} className="peer sr-only" />
                          <Label
                            htmlFor={`plan-${plan.id}`}
                            className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              selectedPlan === plan.id
                                ? 'border-primary bg-primary/5'
                                : 'border-border/60 hover:border-primary/40'
                            }`}
                          >
                            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <plan.icon className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-sm">{plan.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{plan.description || 'Coverage for you and your family'}</p>
                            </div>
                            {selectedPlan === plan.id && <CheckCircle className="w-5 h-5 text-primary shrink-0" />}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Step 2: Plan Tier */}
              {selectedPlan && (
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">2</span>
                      Select Plan Tier
                    </CardTitle>
                    <CardDescription>Choose your coverage level and monthly premium</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup value={selectedTier || ''} onValueChange={setSelectedTier}>
                      <div className="grid sm:grid-cols-3 gap-4">
                        {plans.find(p => p.id === selectedPlan)?.tiers.map((tier: any) => (
                          <div key={tier.id}>
                            <RadioGroupItem value={tier.id} id={`tier-${tier.id}`} className="peer sr-only" />
                            <Label
                              htmlFor={`tier-${tier.id}`}
                              className={`flex flex-col items-center p-5 rounded-xl border-2 cursor-pointer transition-all text-center ${
                                selectedTier === tier.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border/60 hover:border-primary/40'
                              }`}
                            >
                              <span className="text-sm font-semibold capitalize mb-1">{tier.name}</span>
                              <span className="text-2xl font-bold text-primary">KES {Number(tier.price).toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground mb-3">/month</span>
                              <Separator className="w-full mb-3" />
                              <span className="text-xs text-muted-foreground">Coverage up to</span>
                              <span className="text-sm font-semibold mt-0.5">{tier.coverage}</span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Duration */}
              {selectedTier && (
                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">3</span>
                      Choose Duration
                    </CardTitle>
                    <CardDescription>Annual plans come with a 10% discount</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {(['monthly', 'annual'] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setSelectedDuration(d)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            selectedDuration === d ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold capitalize text-sm">{d}</p>
                            {d === 'annual' && (
                              <Badge className="bg-success/10 text-success border-success/20 text-xs">Save 10%</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {d === 'monthly'
                              ? `KES ${Number(selectedTierDetails?.price || 0).toLocaleString()} / month`
                              : `KES ${Math.round(Number(selectedTierDetails?.price || 0) * 12 * 0.9).toLocaleString()} / year`}
                          </p>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right — Payment Summary */}
            <div>
              <Card className="shadow-sm border-border/50 sticky top-24">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Payment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedTierDetails ? (
                    <>
                      <div className="bg-muted/40 rounded-lg p-3 space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Plan</span>
                          <span className="font-medium capitalize">{selectedTierDetails.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duration</span>
                          <span className="font-medium capitalize">{selectedDuration}</span>
                        </div>
                        {selectedDuration === 'annual' && (
                          <div className="flex justify-between text-success text-xs">
                            <span>10% annual discount</span>
                            <span>- KES {Math.round(Number(selectedTierDetails.price) * 12 * 0.1).toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="flex justify-between font-bold">
                        <span>Total</span>
                        <span className="text-primary">KES {Math.round(totalAmount || 0).toLocaleString()}</span>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">
                          M-Pesa Phone Number
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="mpesa-phone-input"
                            className="pl-9"
                            placeholder="07XXXXXXXX or 01XXXXXXXX"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Select a plan and tier to see the payment summary
                    </p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    id="pay-premium-btn"
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={!selectedTier || paying}
                    onClick={handlePayment}
                  >
                    {paying ? (
                      <><Loader2 className="animate-spin w-4 h-4 mr-2" /> Processing...</>
                    ) : (
                      'Pay with M-Pesa'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default CustomerPolicies;
