import { useState } from 'react';
import { CreditCard, CheckCircle, Shield, Heart, Accessibility } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';

const plans = [
  {
    id: 'funeral',
    name: 'Funeral Expenses Cover',
    icon: Heart,
    description: 'Coverage for funeral and burial expenses',
    tiers: [
      { id: 'funeral-basic', name: 'Basic', coverage: 'KSH 100,000', price: 'KSH 500/month' },
      { id: 'funeral-standard', name: 'Standard', coverage: 'KSH 300,000', price: 'KSH 1,200/month' },
      { id: 'funeral-premium', name: 'Premium', coverage: 'KSH 500,000', price: 'KSH 2,000/month' },
    ],
  },
  {
    id: 'loan',
    name: 'Loan Guard Cover',
    icon: Shield,
    description: 'Protection for outstanding loan balances',
    tiers: [
      { id: 'loan-basic', name: 'Basic', coverage: 'KSH 500,000', price: 'KSH 800/month' },
      { id: 'loan-standard', name: 'Standard', coverage: 'KSH 1,000,000', price: 'KSH 1,500/month' },
      { id: 'loan-premium', name: 'Premium', coverage: 'KSH 2,000,000', price: 'KSH 2,800/month' },
    ],
  },
  {
    id: 'disability',
    name: 'Permanent Disability Cover',
    icon: Accessibility,
    description: 'Financial support for permanent disability',
    tiers: [
      { id: 'disability-basic', name: 'Basic', coverage: 'KSH 150,000', price: 'KSH 600/month' },
      { id: 'disability-standard', name: 'Standard', coverage: 'KSH 300,000', price: 'KSH 1,100/month' },
      { id: 'disability-premium', name: 'Premium', coverage: 'KSH 500,000', price: 'KSH 1,800/month' },
    ],
  },
];

const CustomerPayments = () => {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePayment = () => {
    if (!selectedPlan || !selectedTier) {
      toast({
        title: 'Selection Required',
        description: 'Please select a cover type and plan tier.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Payment Initiated',
      description: 'Redirecting to M-Pesa for payment...',
    });
  };

  const getSelectedPlanDetails = () => {
    if (!selectedPlan || !selectedTier) return null;
    
    const plan = plans.find(p => p.id === selectedPlan);
    const tier = plan?.tiers.find(t => t.id === selectedTier);
    
    return { plan, tier };
  };

  const details = getSelectedPlanDetails();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">Select and pay for your insurance cover</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Plans Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cover Type Selection */}
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle>Step 1: Select Cover Type</CardTitle>
                <CardDescription>Choose the type of insurance coverage you need</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={selectedPlan || ''} onValueChange={(value) => { setSelectedPlan(value); setSelectedTier(null); }}>
                  <div className="grid gap-4">
                    {plans.map((plan) => (
                      <div key={plan.id}>
                        <RadioGroupItem value={plan.id} id={plan.id} className="peer sr-only" />
                        <Label
                          htmlFor={plan.id}
                          className="flex items-center gap-4 p-4 rounded-xl border-2 border-border cursor-pointer transition-all hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                        >
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <plan.icon className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{plan.name}</p>
                            <p className="text-sm text-muted-foreground">{plan.description}</p>
                          </div>
                          {selectedPlan === plan.id && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Tier Selection */}
            {selectedPlan && (
              <Card className="border-0 shadow-card animate-fade-in">
                <CardHeader>
                  <CardTitle>Step 2: Select Plan Tier</CardTitle>
                  <CardDescription>Choose your coverage level and monthly premium</CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={selectedTier || ''} onValueChange={setSelectedTier}>
                    <div className="grid sm:grid-cols-3 gap-4">
                      {plans.find(p => p.id === selectedPlan)?.tiers.map((tier) => (
                        <div key={tier.id}>
                          <RadioGroupItem value={tier.id} id={tier.id} className="peer sr-only" />
                          <Label
                            htmlFor={tier.id}
                            className="flex flex-col items-center p-6 rounded-xl border-2 border-border cursor-pointer transition-all hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 text-center"
                          >
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

          {/* Payment Summary */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-card sticky top-24">
              <CardHeader>
                <CardTitle>Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {details?.plan && details?.tier ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cover Type</span>
                      <span className="font-medium">{details.plan.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plan Tier</span>
                      <span className="font-medium">{details.tier.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Coverage</span>
                      <span className="font-medium">{details.tier.coverage}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold">Monthly Premium</span>
                      <span className="font-bold text-primary">{details.tier.price}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a cover type and plan to see summary</p>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  size="lg" 
                  disabled={!selectedPlan || !selectedTier}
                  onClick={handlePayment}
                >
                  Pay with M-Pesa
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>

        {/* Payment History */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>Your recent premium payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { date: '2024-01-01', amount: 'KSH 2,000', plan: 'Funeral Expenses - Premium', status: 'Completed' },
                { date: '2023-12-01', amount: 'KSH 2,000', plan: 'Funeral Expenses - Premium', status: 'Completed' },
                { date: '2023-11-01', amount: 'KSH 2,000', plan: 'Funeral Expenses - Premium', status: 'Completed' },
              ].map((payment, index) => (
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
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CustomerPayments;
