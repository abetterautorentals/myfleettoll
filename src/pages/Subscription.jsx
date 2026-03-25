import React, { useState } from 'react';
import { useTenant, PLANS } from '@/lib/TenantContext';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Check, Loader2, CreditCard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const PLAN_FEATURES = {
  starter:      ['1 fleet', 'Up to 50 tolls/month', 'OCR toll extraction', 'Smart matching', 'Email support'],
  professional: ['Up to 3 fleets', 'Unlimited tolls', 'All Starter features', 'FasTrak auto-submit', 'Priority support'],
  business:     ['Unlimited fleets', 'Unlimited tolls', 'All Pro features', 'White-label option', 'Dedicated support'],
};

export default function Subscription() {
  const { tenant, plan, isOwner, refreshTenant } = useTenant();
  const [loading, setLoading] = useState(null);
  const { toast } = useToast();

  const handleUpgrade = async (planKey) => {
    setLoading(planKey);
    const res = await base44.functions.invoke('stripeCheckout', { plan: planKey, tenant_id: tenant.id });
    if (res.data?.url) {
      window.location.href = res.data.url;
    } else {
      toast({ title: 'Error', description: 'Could not start checkout. Please try again.', variant: 'destructive' });
    }
    setLoading(null);
  };

  const handleManageBilling = async () => {
    setLoading('manage');
    const res = await base44.functions.invoke('stripePortal', { tenant_id: tenant.id });
    if (res.data?.url) {
      window.location.href = res.data.url;
    }
    setLoading(null);
  };

  if (isOwner) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <span className="text-6xl mb-3">👑</span>
        <h2 className="text-2xl font-black">Owner Account</h2>
        <p className="text-muted-foreground text-sm mt-1">Free forever. Unlimited everything.</p>
      </div>
    );
  }

  const currentPlan = tenant?.subscription_plan || 'starter';
  const status = tenant?.subscription_status;

  return (
    <div className="p-4 pb-20 max-w-lg mx-auto">
      <div className="pt-4 pb-4">
        <h1 className="text-2xl font-black">💳 Subscription</h1>
        <p className="text-sm text-muted-foreground">Manage your plan and billing</p>
      </div>

      {/* Current Plan */}
      <div className="bg-primary/10 border-2 border-primary/30 rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground">Current Plan</p>
            <p className="text-xl font-black text-primary">{PLANS[currentPlan]?.name}</p>
            <p className="text-sm font-bold">${PLANS[currentPlan]?.price}/month</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-black ${
            status === 'active' ? 'bg-green-100 text-green-700' :
            status === 'trialing' ? 'bg-blue-100 text-blue-700' :
            status === 'past_due' ? 'bg-red-100 text-red-700 animate-pulse' :
            'bg-secondary text-muted-foreground'
          }`}>{status?.toUpperCase()}</span>
        </div>
        {tenant?.stripe_subscription_id && (
          <Button onClick={handleManageBilling} disabled={loading === 'manage'} variant="outline"
            className="w-full mt-3 h-9 rounded-xl font-bold text-sm gap-2">
            {loading === 'manage' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Manage Billing & Invoices
          </Button>
        )}
      </div>

      {/* Plan Cards */}
      <div className="space-y-3">
        {(['starter', 'professional', 'business']).map(planKey => {
          const p = PLANS[planKey];
          const isCurrent = currentPlan === planKey;
          const features = PLAN_FEATURES[planKey];
          return (
            <motion.div key={planKey} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border-2 p-4 ${isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-black text-lg">{p.name}</p>
                  <p className="text-2xl font-black">${p.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                </div>
                {isCurrent ? (
                  <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">Current</span>
                ) : (
                  <Button size="sm" onClick={() => handleUpgrade(planKey)} disabled={!!loading}
                    className="rounded-xl font-bold h-8 text-xs">
                    {loading === planKey ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Upgrade'}
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                {features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs">
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center mt-4">
        Cancel anytime. No refunds for partial months.
      </p>
    </div>
  );
}