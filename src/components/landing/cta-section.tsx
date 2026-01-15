import Link from 'next/link';
import {
  ArrowRight,
  Zap,
  Globe,
  Scale,
  Shield,
  CheckCircle2,
} from 'lucide-react';

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
    <SectionWrapper id="cta" className="border-t-0 overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5" />

      {/* Decorative Elements */}
      <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative mx-auto max-w-4xl">
        {/* Main Content */}
        <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur-sm px-4 py-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>No lawyer required</span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Ready to Resolve Your Dispute?
          </h2>

          {/* Subheadline */}
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Get started in minutes and receive a legally binding decision in weeks, not months.
            Our platform guides you through every step.
          </p>
        </div>

        {/* Benefits Row */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.text}
              className={cn(
                'flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur-sm px-4 py-2',
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
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
          <Link href="/sign-up">
            <Button size="lg" className="gap-2 text-base px-8 py-6 h-auto shadow-lg shadow-primary/20">
              Start Your Case Now
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/contact">
            <Button size="lg" variant="outline" className="text-base px-8 py-6 h-auto bg-background/80 backdrop-blur-sm">
              Contact Us
            </Button>
          </Link>
        </div>

        {/* Quick Steps */}
        <div className="mt-16 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
          <p className="text-center text-sm font-medium text-muted-foreground mb-6">
            Getting started is easy
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {steps.map((step, index) => (
              <div
                key={step}
                className="flex flex-col items-center text-center"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  {index + 1}
                </div>
                <p className="text-sm text-muted-foreground">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final Trust Line */}
        <div className="mt-12 text-center animate-in fade-in duration-500 delay-700">
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
