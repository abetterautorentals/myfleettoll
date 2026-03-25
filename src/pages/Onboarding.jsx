import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { useTheme } from '@/lib/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import confetti from 'canvas-confetti';
import { CheckCircle, ChevronRight, Plus, Trash2, Sun, Moon, Monitor, Check } from 'lucide-react';

const PLATFORMS = [
  { id: 'turo', label: 'Turo', emoji: '🚗' },
  { id: 'upcar', label: 'UpCar', emoji: '🚙' },
  { id: 'rentcentric', label: 'RentCentric', emoji: '📋' },
  { id: 'signnow', label: 'SignNow', emoji: '✍️' },
  { id: 'direct', label: 'Direct', emoji: '🤝' },
  { id: 'docusign', label: 'DocuSign', emoji: '📝' },
];

// Steps: 0=Welcome, 1=Terms, 2=Theme, 3=Company+Fleet, 4=Platforms, 5=Done
const TOTAL_STEPS = 6;

export default function Onboarding({ onComplete }) {
  const { user, refreshTenant } = useTenant();
  const { theme, setTheme } = useTheme();
  const [step, setStep] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [fleetName, setFleetName] = useState('');
  const [platforms, setPlatforms] = useState([]);
  const [saving, setSaving] = useState(false);

  const togglePlatform = (pid) => {
    setPlatforms(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]);
  };

  const handleFinish = async () => {
    setSaving(true);
    const tenant = await base44.entities.Tenant.create({
      owner_user_id: user.id,
      owner_email: user.email,
      company_name: companyName,
      subscription_plan: 'starter',
      subscription_status: 'trialing',
      trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      onboarding_completed: true,
      terms_accepted: true,
      terms_accepted_at: new Date().toISOString(),
    });

    if (fleetName.trim()) {
      const alias = fleetName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
      await base44.entities.Fleet.create({
        tenant_id: tenant.id,
        name: fleetName.trim(),
        platforms,
        email_alias: `${alias}@fleettollpro.com`,
        is_active: true,
        color: '#4A9EFF',
      });
    }

    confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
    await refreshTenant();
    setSaving(false);
    onComplete();
  };

  const slideProps = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
    transition: { duration: 0.25 },
  };

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
      <div className="max-w-md mx-auto px-5 py-10 min-h-screen flex flex-col">

        {/* Progress bar (hidden on step 0) */}
        {step > 0 && step < TOTAL_STEPS - 1 && (
          <div className="w-full h-1.5 bg-secondary rounded-full mb-8 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${((step) / (TOTAL_STEPS - 2)) * 100}%` }} />
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">

            {/* STEP 0: Welcome */}
            {step === 0 && (
              <motion.div key="welcome" {...slideProps} className="text-center">
                <div className="text-7xl mb-6">🚗</div>
                <h1 className="text-4xl font-black mb-3">Welcome to<br />FleetToll Pro</h1>
                <p className="text-muted-foreground mb-8">The smartest way to manage tolls, disputes, and rental contracts — all in one place.</p>
                <div className="space-y-2 text-left bg-secondary rounded-2xl p-4 mb-8">
                  {['📧 Auto-import tolls from email', '🤖 AI-powered renter matching', '📄 1-click dispute PDFs', '📊 Fleet analytics dashboard'].map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm font-semibold">{f}</div>
                  ))}
                </div>
                <Button onClick={() => setStep(1)} className="w-full h-14 rounded-2xl font-black text-lg gap-2">
                  Get Started <ChevronRight className="w-5 h-5" />
                </Button>
              </motion.div>
            )}

            {/* STEP 1: Terms */}
            {step === 1 && (
              <motion.div key="terms" {...slideProps}>
                <h1 className="text-2xl font-black mb-1">Terms of Service 📋</h1>
                <p className="text-muted-foreground text-sm mb-4">Please read and accept before continuing.</p>
                <div className="bg-secondary rounded-2xl p-4 text-xs text-muted-foreground space-y-2 max-h-64 overflow-y-auto mb-5">
                  <p className="font-bold text-foreground">Terms of Service & Privacy Policy</p>
                  <p><strong>1. Management Tool Only.</strong> FleetToll Pro is a management tool. We do not guarantee outcomes with FasTrak or any toll agency.</p>
                  <p><strong>2. Your Responsibility.</strong> You are responsible for verifying all AI-extracted information before sending to any agency.</p>
                  <p><strong>3. Document Processing.</strong> You grant permission to process your uploaded documents solely for toll management purposes.</p>
                  <p><strong>4. Data Security.</strong> Your data is stored securely and never sold to third parties.</p>
                  <p><strong>5. Billing.</strong> Subscriptions auto-renew monthly. Cancel anytime. No refunds for partial months.</p>
                  <p><strong>6. GDPR/CCPA.</strong> You may request deletion of your data at any time via account settings.</p>
                  <p><strong>7. Liability.</strong> FleetToll Pro is provided "as is". Our maximum liability is limited to your last month's subscription fee.</p>
                </div>
                <label className="flex items-start gap-3 cursor-pointer mb-6 bg-primary/5 border-2 border-primary/20 rounded-xl p-3">
                  <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="w-5 h-5 rounded mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-semibold">I have read and accept the Terms of Service and Privacy Policy</span>
                </label>
                <Button onClick={() => setStep(2)} disabled={!termsAccepted} className="w-full h-12 rounded-2xl font-bold">
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {/* STEP 2: Theme */}
            {step === 2 && (
              <motion.div key="theme" {...slideProps}>
                <h1 className="text-2xl font-black mb-1">Choose Your Theme 🎨</h1>
                <p className="text-muted-foreground text-sm mb-6">Pick a look that feels right. You can always change it later.</p>
                <div className="grid grid-cols-3 gap-3 mb-8">
                  {[
                    { id: 'dark', label: 'Dark', icon: Moon, desc: 'Premium dark' },
                    { id: 'light', label: 'Light', icon: Sun, desc: 'Clean & bright' },
                    { id: 'auto', label: 'Auto', icon: Monitor, desc: 'Follows system' },
                  ].map(({ id, label, icon: Icon, desc }) => (
                    <button key={id} onClick={() => setTheme(id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                        theme === id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground'
                      }`}>
                      <Icon className="w-7 h-7" />
                      <span className="text-sm font-black">{label}</span>
                      <span className="text-[10px]">{desc}</span>
                      {theme === id && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
                <Button onClick={() => setStep(3)} className="w-full h-12 rounded-2xl font-bold">
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {/* STEP 3: Company + Fleet name */}
            {step === 3 && (
              <motion.div key="company" {...slideProps}>
                <h1 className="text-2xl font-black mb-1">Your Business 🏢</h1>
                <p className="text-muted-foreground text-sm mb-6">Tell us about your company and first fleet.</p>
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">Company Name</label>
                    <Input
                      placeholder="e.g. Bay Area Car Rentals LLC"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      className="h-12 rounded-2xl font-bold text-base"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">First Fleet Name</label>
                    <Input
                      placeholder="e.g. Main Fleet, Downtown Cars..."
                      value={fleetName}
                      onChange={e => setFleetName(e.target.value)}
                      className="h-12 rounded-2xl font-bold text-base"
                    />
                  </div>
                </div>
                <Button onClick={() => setStep(4)} disabled={!companyName.trim() || !fleetName.trim()} className="w-full h-12 rounded-2xl font-bold">
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {/* STEP 4: Platforms */}
            {step === 4 && (
              <motion.div key="platforms" {...slideProps}>
                <h1 className="text-2xl font-black mb-1">Rental Platforms 🔌</h1>
                <p className="text-muted-foreground text-sm mb-2">Which platforms does <strong>{fleetName}</strong> use?</p>
                <p className="text-xs text-muted-foreground mb-5">Select all that apply. This helps us auto-import your tolls and contracts.</p>
                <div className="grid grid-cols-2 gap-2 mb-8">
                  {PLATFORMS.map(p => (
                    <button key={p.id} onClick={() => togglePlatform(p.id)}
                      className={`flex items-center gap-2 px-3 py-3 rounded-2xl border-2 text-sm font-bold transition-all ${
                        platforms.includes(p.id) ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-secondary text-foreground'
                      }`}>
                      <span className="text-lg">{p.emoji}</span> {p.label}
                      {platforms.includes(p.id) && <Check className="w-4 h-4 ml-auto" />}
                    </button>
                  ))}
                </div>
                <Button onClick={() => setStep(5)} className="w-full h-12 rounded-2xl font-bold">
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {/* STEP 5: Celebration */}
            {step === 5 && (
              <motion.div key="done" {...slideProps} className="text-center">
                <div className="text-7xl mb-4">🎉</div>
                <h1 className="text-3xl font-black mb-2">You're all set!</h1>
                <p className="text-muted-foreground mb-6">
                  <strong>{companyName}</strong> is ready to go.<br />
                  Your first fleet <strong>{fleetName}</strong> has been created.
                </p>
                <div className="bg-secondary rounded-2xl p-4 text-left space-y-2 mb-8">
                  <p className="text-sm font-bold text-muted-foreground">Next steps:</p>
                  {['📸 Upload your first toll notice', '📧 Forward toll emails to your fleet alias', '📋 Add rental contracts for matching'].map(s => (
                    <div key={s} className="text-sm font-semibold flex items-center gap-2">
                      {s}
                    </div>
                  ))}
                </div>
                <Button onClick={handleFinish} disabled={saving}
                  className="w-full h-14 rounded-2xl font-black text-lg bg-green-500 hover:bg-green-600 text-white">
                  {saving ? '⏳ Setting up your account...' : '🚀 Enter FleetToll Pro'}
                </Button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}