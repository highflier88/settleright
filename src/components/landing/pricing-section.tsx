'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Shield,
  Calculator,
  Scale,
  Gavel,
  Clock,
  ArrowRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SectionWrapper } from './section-wrapper';

interface PricingTier {
  claimRange: string;
  minAmount: number;
  maxAmount: number;
  fee: number;
  popular: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    claimRange: 'Up to $1,000',
    minAmount: 500,
    maxAmount: 1000,
    fee: 49,
    popular: false,
  },
  {
    claimRange: '$1,001 - $5,000',
    minAmount: 1001,
    maxAmount: 5000,
    fee: 99,
    popular: true,
  },
  {
    claimRange: '$5,001 - $10,000',
    minAmount: 5001,
    maxAmount: 10000,
    fee: 149,
    popular: false,
  },
  {
    claimRange: '$10,001 - $25,000',
    minAmount: 10001,
    maxAmount: 25000,
    fee: 249,
    popular: false,
  },
];

const includedFeatures = [
  'AI-powered case analysis',
  'Human arbitrator review',
  'Legally binding decision',
  'Digital document storage',
  'Email notifications',
  'Secure evidence upload',
];

const courtComparison = [
  { label: 'Filing fee', court: '$75-150', settleright: 'From $49' },
  { label: 'Time to resolution', court: '2-6 months', settleright: '2-4 weeks' },
  { label: 'Court appearances', court: 'Multiple visits', settleright: 'None (100% online)' },
  { label: 'Time off work', court: 'Required', settleright: 'Not needed' },
];

function calculateFee(amount: number): number | null {
  if (amount < 500 || amount > 25000) return null;
  const tier = pricingTiers.find(
    (t) => amount >= t.minAmount && amount <= t.maxAmount
  );
  return tier?.fee ?? null;
}

export function PricingSection() {
  const [claimAmount, setClaimAmount] = useState<string>('');
  const [calculatedFee, setCalculatedFee] = useState<number | null>(null);

  const handleAmountChange = (value: string) => {
    // Remove non-numeric characters except decimal
    const cleanValue = value.replace(/[^0-9.]/g, '');
    setClaimAmount(cleanValue);

    const amount = parseFloat(cleanValue);
    if (!isNaN(amount)) {
      setCalculatedFee(calculateFee(amount));
    } else {
      setCalculatedFee(null);
    }
  };

  return (
    <SectionWrapper id="pricing" background="muted">
      <div className="mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="mb-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            One flat fee based on your claim amount. No hidden costs.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pricingTiers.map((tier, index) => (
            <div
              key={tier.claimRange}
              className={cn(
                'group relative rounded-xl border bg-background p-6 text-center transition-all duration-300',
                'hover:shadow-lg',
                tier.popular
                  ? 'border-2 border-primary shadow-lg shadow-primary/10 scale-105 z-10'
                  : 'hover:border-primary/50',
                'animate-in fade-in slide-in-from-bottom-4',
              )}
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground shadow-md">
                    Most Common
                  </span>
                </div>
              )}

              {/* Claim Range */}
              <p className="text-sm font-medium text-muted-foreground">
                {tier.claimRange}
              </p>

              {/* Price */}
              <div className="mt-4 mb-2">
                <span className="text-5xl font-bold tracking-tight">${tier.fee}</span>
              </div>
              <p className="text-xs text-muted-foreground">one-time filing fee</p>

              {/* Hover CTA */}
              <div className="mt-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <Link href="/sign-up">
                  <Button size="sm" variant={tier.popular ? 'default' : 'outline'} className="w-full">
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Fee Calculator */}
        <div className="mt-12 rounded-xl border-2 border-dashed border-primary/30 bg-background p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
            <div className="flex items-center gap-3 text-center md:text-left">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Fee Calculator</h3>
                <p className="text-sm text-muted-foreground">Enter your claim amount</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="5,000"
                  value={claimAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-40 pl-7 text-center text-lg font-medium"
                />
              </div>

              <ArrowRight className="hidden h-5 w-5 text-muted-foreground sm:block" />

              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2">
                {calculatedFee !== null ? (
                  <>
                    <span className="text-sm text-muted-foreground">Your fee:</span>
                    <span className="text-2xl font-bold text-primary">${calculatedFee}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {claimAmount && parseFloat(claimAmount) > 0
                      ? 'Claims: $500-$25,000'
                      : 'Enter amount above'}
                  </span>
                )}
              </div>

              {calculatedFee !== null && (
                <Link href="/sign-up">
                  <Button>
                    Start for ${calculatedFee}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* What's Included */}
        <div className="mt-12 rounded-xl border bg-background p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
          <div className="flex items-center justify-center gap-2 text-center">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Everything included with every filing</h3>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {includedFeatures.map((feature, index) => (
              <div
                key={feature}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Court Comparison */}
        <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-700">
          <h3 className="mb-6 text-center text-lg font-semibold">
            Compare to Traditional Small Claims Court
          </h3>
          <div className="overflow-hidden rounded-xl border bg-background">
            <div className="grid grid-cols-3 border-b bg-muted/50 p-4 text-sm font-medium">
              <div></div>
              <div className="text-center text-muted-foreground">
                <Gavel className="mx-auto mb-1 h-4 w-4" />
                Court
              </div>
              <div className="text-center text-primary">
                <Scale className="mx-auto mb-1 h-4 w-4" />
                Settleright.ai
              </div>
            </div>
            {courtComparison.map((row, index) => (
              <div
                key={row.label}
                className={cn(
                  'grid grid-cols-3 p-4 text-sm',
                  index < courtComparison.length - 1 && 'border-b'
                )}
              >
                <div className="font-medium">{row.label}</div>
                <div className="text-center text-muted-foreground">{row.court}</div>
                <div className="text-center font-medium text-primary">{row.settleright}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center animate-in fade-in duration-500 delay-1000">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground mb-6">
            <Clock className="h-4 w-4 text-primary" />
            <span>Most cases resolve in 2-4 weeks</span>
          </div>
          <div>
            <Link href="/sign-up">
              <Button size="lg" className="gap-2">
                Start Your Case
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
