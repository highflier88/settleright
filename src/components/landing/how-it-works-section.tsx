import Link from 'next/link';

import {
  FileText,
  PenTool,
  Upload,
  Brain,
  Scale,
  Award,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { SectionWrapper } from './section-wrapper';

interface Step {
  number: number;
  title: string;
  description: string;
  icon: LucideIcon;
}

const steps: Step[] = [
  {
    number: 1,
    title: 'File Your Claim',
    description: 'Submit dispute details, claim amount, and invite the other party',
    icon: FileText,
  },
  {
    number: 2,
    title: 'Both Parties Sign',
    description: 'Digital signatures on binding arbitration agreement',
    icon: PenTool,
  },
  {
    number: 3,
    title: 'Submit Evidence',
    description: '14-day window to upload documents, photos, and statements',
    icon: Upload,
  },
  {
    number: 4,
    title: 'AI Analysis',
    description: 'AI analyzes facts, evidence, and identifies legal issues',
    icon: Brain,
  },
  {
    number: 5,
    title: 'Arbitrator Review',
    description: 'Human arbitrator reviews analysis and makes final decision',
    icon: Scale,
  },
  {
    number: 6,
    title: 'Receive Award',
    description: 'Legally enforceable decision delivered to both parties',
    icon: Award,
  },
];

export function HowItWorksSection() {
  return (
    <SectionWrapper id="how-it-works">
      <div className="mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="mb-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Six simple steps from filing to resolution
          </p>
        </div>

        {/* Desktop: Horizontal Timeline */}
        <div className="hidden lg:block">
          <div className="relative">
            {/* Connector Line with Gradient */}
            <div className="absolute left-[8%] right-[8%] top-10 h-1 rounded-full bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20" />

            {/* Steps */}
            <div className="relative grid grid-cols-6 gap-4">
              {steps.map((step, index) => (
                <div
                  key={step.number}
                  className={cn(
                    'group flex flex-col items-center text-center',
                    'animate-in fade-in slide-in-from-bottom-4',
                  )}
                  style={{ animationDelay: `${(index + 1) * 100}ms` }}
                >
                  {/* Icon Circle with Glow Effect */}
                  <div className="relative z-10">
                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-md transition-all duration-300 group-hover:bg-primary/40 group-hover:blur-lg" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary bg-background shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-primary/25">
                      <step.icon className="h-8 w-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                    </div>
                  </div>
                  {/* Step Number Badge */}
                  <div className="relative -mt-3 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-md ring-2 ring-background">
                    {step.number}
                  </div>
                  {/* Content */}
                  <h3 className="mt-4 text-sm font-semibold transition-colors duration-300 group-hover:text-primary">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile/Tablet: Vertical Stepper */}
        <div className="lg:hidden">
          <div className="relative space-y-6">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={cn(
                  'group relative flex gap-5',
                  'animate-in fade-in slide-in-from-left-4',
                )}
                style={{ animationDelay: `${(index + 1) * 100}ms` }}
              >
                {/* Connector Line with Gradient */}
                {index < steps.length - 1 && (
                  <div className="absolute left-7 top-16 h-[calc(100%+1.5rem)] w-0.5 bg-gradient-to-b from-primary/60 to-primary/20" />
                )}

                {/* Icon Circle with Glow */}
                <div className="relative z-10 shrink-0">
                  <div className="absolute inset-0 rounded-full bg-primary/20 blur-sm transition-all duration-300 group-hover:bg-primary/30" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-background shadow-md transition-all duration-300 group-hover:shadow-lg group-hover:shadow-primary/20">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>

                {/* Content Card */}
                <div className="flex-1 rounded-lg border bg-background/50 p-4 transition-all duration-300 group-hover:border-primary/30 group-hover:bg-background group-hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">
                      {step.number}
                    </span>
                    <h3 className="font-semibold transition-colors duration-300 group-hover:text-primary">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center animate-in fade-in duration-500 delay-700">
          <p className="text-lg text-muted-foreground">
            Ready to start your case?
          </p>
          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/sign-up">
              <Button size="lg">Start Your Case</Button>
            </Link>
            <Link href="#pricing">
              <Button variant="outline" size="lg">View Pricing</Button>
            </Link>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
