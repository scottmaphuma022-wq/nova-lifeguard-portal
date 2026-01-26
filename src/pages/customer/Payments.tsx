import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, Shield, Heart, Accessibility, Phone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabaseClient';

/* ============================
   TYPES
============================= */
interface Tier {
  id: string;
  name: string;
  coverage: string;
  price: string;
}

interface Plan {
  id: string;
  name: string;
  icon: any;
  description: string;
  tiers: Tier[];
}

interface Payment {
  date: string;
  amount: string;
  plan: string;
  status: string;
}

/* ============================
   ICON MAP
============================= */
const iconMap: Record<string, any> = {
  funeral: Heart,
  loan: Shield,
  disability: Accessibility,
};

/* ============================
   PHONE NORMALIZATION
============================= */
const normalizePhone = (phone: string) => {
  const cleaned = phone.replace(/\s+/g, '');

  if (cleaned.startsWith('07') || cleaned.startsWith('01')) {
    return `254${cleaned.substring(1)}`;
  }

  if (cleaned.startsWith('254')) {
    return cleaned;
  }

  throw new Error('Invalid phone number format');
};

const CustomerPayments = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  /* ============================
     FETCH PLANS
  ============================= */
  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from('covers')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      toast({
        title: 'Error',
        description: 'Unable to fetch plans.',
        variant: 'destructive',
      });
      return;
    }

    const planMap: Record<string, Plan> = {};

    data.forEach((cover: any) => {
      if (!planMap[cover.cover_type]) {
        planMap[cover.cover_type] = {
          id: cover.cover_type,
          name: cover.cover_type.replace(/_/g, ' ').toUpperCase(),
          icon: iconMap[cover.cover_type] || Heart,
          description: cover.description || '',
          tiers: [],
        };
      }

      planMap[cover.cover_type].tiers.push({
        id: cover.id,                  // cover_id (FK)
        name: cover.plan_tier,         // enum value
        coverage: cover.cover_name,
        price: `KSH ${cover.price}`,
      });
    });

    setPlans(Object.values(planMap));
  };

  /* ============================
     FETCH PAYMENT HISTORY
  ============================= */
  const fetchPayments = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;

    const { data } = await supabase
      .from('payments')
      .select(`
        amount_paid,
        payment_date,
        plan_tier,
        cover:cover_id (cover_name)
      `)
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false });

    setPayments(
      data?.map((p: any) => ({
        date: new Date(p.payment_date).toLocaleDateString(),
        amount: `KSH ${p.amount_paid}`,
        plan: `${p.cover.cover_name} - ${p.plan_tier}`,
        status: 'Completed',
      })) || []
    );
  };

  useEffect(() => {
    fetchPlans();
    fetchPayments();
  }, []);

  /* ============================
     HANDLE STK PUSH
  ============================= */
  const handlePayment = async () => {
    if (!selectedTier || !phone) {
      toast({
        title: 'Missing Details',
        description: 'Please select a plan and enter phone number',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        throw new Error('You must be logged in to make a payment');
      }

      const normalizedPhone = normalizePhone(phone);

      const tier = plans.flatMap(p => p.tiers).find(t => t.id === selectedTier);
      if (!tier) throw new Error('Invalid plan tier selected');

      const amount = Number(tier.price.replace('KSH ', ''));
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      /* 🔍 DEBUG LOG — SAFE TO REMOVE LATER */
      console.log('STK PUSH PAYLOAD:', {
        phone: normalizedPhone,
        amount,
        user_id: user.id,
        cover_id: tier.id,
        plan_tier: tier.name,
      });

      const res = await fetch('/api/payments/stkpush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalizedPhone,
          amount,
          user_id: user.id,       // REQUIRED
          cover_id: tier.id,      // FK → covers.id
          plan_tier: tier.name,   // enum
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'STK push failed');

      toast({
        title: 'STK Push Sent',
        description: 'Confirm payment on your phone',
      });

      setPhone('');
    } catch (err: any) {
      toast({
        title: 'Payment Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  /* ============================
     SELECTED DETAILS
  ============================= */
  const details = (() => {
    if (!selectedPlan || !selectedTier) return null;
    const plan = plans.find(p => p.id === selectedPlan);
    const tier = plan?.tiers.find(t => t.id === selectedTier);
    return { plan, tier };
  })();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">Select and pay for your insurance cover</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* LEFT SIDE */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle>Step 1: Select Cover Type</CardTitle>
                <CardDescription>Choose the type of insurance coverage you need</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={selectedPlan || ''} onValueChange={(v) => { setSelectedPlan(v); setSelectedTier(null); }}>
                  <div className="grid gap-4">
                    {plans.map(plan => (
                      <div key={plan.id}>
                        <RadioGroupItem value={plan.id} id={plan.id} className="peer sr-only" />
                        <Label htmlFor={plan.id} className="flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <plan.icon className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{plan.name}</p>
                            <p className="text-sm text-muted-foreground">{plan.description}</p>
                          </div>
                          {selectedPlan === plan.id && <CheckCircle className="h-5 w-5 text-primary" />}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {selectedPlan && (
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle>Step 2: Select Plan Tier</CardTitle>
                  <CardDescription>Choose your coverage level and monthly premium</CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={selectedTier || ''} onValueChange={setSelectedTier}>
                    <div className="grid sm:grid-cols-3 gap-4">
                      {plans.find(p => p.id === selectedPlan)?.tiers.map(tier => (
                        <div key={tier.id}>
                          <RadioGroupItem value={tier.id} id={tier.id} className="peer sr-only" />
                          <Label htmlFor={tier.id} className="flex flex-col items-center p-6 rounded-xl border-2 cursor-pointer">
                            <span className="text-lg font-semibold mb-2">{tier.name}</span>
                            <span className="text-2xl font-bold text-primary">{tier.price}</span>
                            <Separator className="my-4" />
                            <span className="text-sm text-muted-foreground">Coverage up to</span>
                            <span className="font-semibold">{tier.coverage}</span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT SIDE */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-card sticky top-24">
              <CardHeader>
                <CardTitle>Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {details?.tier && (
                  <>
                    <Separator />
                    <Label className="text-sm">M-Pesa Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-10"
                        placeholder="07XXXXXXXX or 01XXXXXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter>
                <Button className="w-full" size="lg" disabled={!selectedTier || loading} onClick={handlePayment}>
                  {loading ? 'Processing...' : 'Pay with M-Pesa'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>

        {/* PAYMENT HISTORY */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>Your recent premium payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {payments.length > 0 ? payments.map((payment, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">{payment.plan}</p>
                      <p className="text-sm text-muted-foreground">{payment.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{payment.amount}</p>
                    <span className="text-xs text-success">{payment.status}</span>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-center py-4">No payment history available.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CustomerPayments;
