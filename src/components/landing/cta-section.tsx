import Link from 'next/link';

import { ArrowRight, Zap, Globe, Scale, Shield, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { SectionWrapper } from './section-wrapper';

const benefits = [
  { text: 'Resolution in weeks', icon: Zap },
  { text: '100% online', icon: Globe },
  { text: 'Legally binding', icon: Scale },
  { text: 'Secure & private', icon: Shield },
];

const steps = [
  'Create your free account',
  'Submit your dispute details',
  'Invite the other party',
  'Get your resolution',
];

export function CTASection() {
  return (
    <SectionWrapper id="cta" className="overflow-hidden border-t-0">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5" />

      {/* Decorative Elements */}
      <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative mx-auto max-w-4xl">
        {/* Main Content */}
        <div className="text-center duration-500 animate-in fade-in slide-in-from-bottom-4">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-2 text-sm backdrop-blur-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>No lawyer required</span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Ready to Resolve Your Dispute?
          </h2>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Get started in minutes and receive a legally binding decision in weeks, not months. Our
            platform guides you through every step.
          </p>
        </div>

        {/* Benefits Row */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 delay-200 duration-500 animate-in fade-in slide-in-from-bottom-4">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.text}
              className={cn(
                'flex items-center gap-2 rounded-full border bg-background/80 px-4 py-2 backdrop-blur-sm',
                'animate-in fade-in'
              )}
              style={{ animationDelay: `${200 + index * 100}ms` }}
            >
              <benefit.icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{benefit.text}</span>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="delay-400 mt-10 flex flex-col items-center gap-4 duration-500 animate-in fade-in slide-in-from-bottom-4 sm:flex-row sm:justify-center">
          <Link href="/sign-up">
            <Button
              size="lg"
              className="h-auto gap-2 px-8 py-6 text-base shadow-lg shadow-primary/20"
            >
              Start Your Case Now
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/contact">
            <Button
              size="lg"
              variant="outline"
              className="h-auto bg-background/80 px-8 py-6 text-base backdrop-blur-sm"
            >
              Contact Us
            </Button>
          </Link>
        </div>

        {/* Quick Steps */}
        <div className="mt-16 delay-500 duration-500 animate-in fade-in slide-in-from-bottom-4">
          <p className="mb-6 text-center text-sm font-medium text-muted-foreground">
            Getting started is easy
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step} className="flex flex-col items-center text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </div>
                <p className="text-sm text-muted-foreground">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final Trust Line */}
        <div className="mt-12 text-center delay-700 duration-500 animate-in fade-in">
          <p className="text-sm text-muted-foreground">
            Trusted platform built on{' '}
            <span className="font-medium text-foreground">legal compliance</span>,{' '}
            <span className="font-medium text-foreground">bank-level security</span>, and{' '}
            <span className="font-medium text-foreground">professional arbitration</span>.
          </p>
        </div>
      </div>
    </SectionWrapper>
  );
}
