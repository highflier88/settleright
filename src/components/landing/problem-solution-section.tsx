import Link from 'next/link';

import {
  Clock,
  Building2,
  ScrollText,
  HelpCircle,
  DollarSign,
  Zap,
  Laptop,
  ListChecks,
  CalendarCheck,
  Receipt,
  Timer,
  PiggyBank,
  Scale,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { SectionWrapper } from './section-wrapper';

interface ComparisonItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

const problems: ComparisonItem[] = [
  {
    title: 'Slow Process',
    description: 'Traditional court takes weeks or months to resolve disputes',
    icon: Clock,
  },
  {
    title: 'Inconvenient',
    description: 'Requires time off work and physical court appearances',
    icon: Building2,
  },
  {
    title: 'Complex Procedures',
    description: 'Confusing legal paperwork and procedural requirements',
    icon: ScrollText,
  },
  {
    title: 'Uncertain Timeline',
    description: 'No guarantee of when your case will be heard or decided',
    icon: HelpCircle,
  },
  {
    title: 'Hidden Costs',
    description: 'Filing fees, potential attorney costs, and lost wages add up',
    icon: DollarSign,
  },
];

const solutions: ComparisonItem[] = [
  {
    title: 'Fast Resolution',
    description: 'Get a binding decision in days, not months',
    icon: Zap,
  },
  {
    title: '100% Online',
    description: 'File from home—no court visits or time off work needed',
    icon: Laptop,
  },
  {
    title: 'Simple Process',
    description: 'Easy-to-follow steps guide you through every stage',
    icon: ListChecks,
  },
  {
    title: 'Clear Deadlines',
    description: 'Know exactly when each phase of your case will complete',
    icon: CalendarCheck,
  },
  {
    title: 'Transparent Pricing',
    description: 'One flat filing fee—no surprises or hidden costs',
    icon: Receipt,
  },
];

const stats = [
  {
    icon: Timer,
    value: '14 days',
    label: 'avg resolution',
  },
  {
    icon: PiggyBank,
    value: '70%',
    label: 'cost savings',
  },
  {
    icon: Scale,
    value: '100%',
    label: 'legally binding',
  },
];

export function ProblemSolutionSection() {
  return (
    <SectionWrapper id="problem-solution" background="muted">
      <div className="mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            A Better Way to Resolve Disputes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Skip the courthouse. Get the resolution you deserve.
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Problems Column */}
          <div className="rounded-xl border border-dashed border-destructive/30 bg-destructive/5 p-6 duration-500 animate-in fade-in slide-in-from-left-4 md:p-8">
            <h3 className="mb-6 text-center text-xl font-semibold text-muted-foreground">
              Traditional Court
            </h3>
            <ul className="space-y-3">
              {problems.map((item, index) => (
                <li
                  key={item.title}
                  className={cn(
                    'flex gap-4 rounded-lg p-3 transition-colors hover:bg-background/60',
                    'animate-in fade-in slide-in-from-left-2'
                  )}
                  style={{ animationDelay: `${(index + 1) * 100}ms` }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                    <item.icon className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground/70">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions Column */}
          <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-6 shadow-lg duration-500 animate-in fade-in slide-in-from-right-4 md:p-8">
            <h3 className="mb-6 text-center text-xl font-semibold text-primary">Settleright.ai</h3>
            <ul className="space-y-3">
              {solutions.map((item, index) => (
                <li
                  key={item.title}
                  className={cn(
                    'flex gap-4 rounded-lg p-3 transition-colors hover:bg-background/40',
                    'animate-in fade-in slide-in-from-right-2'
                  )}
                  style={{ animationDelay: `${(index + 1) * 100}ms` }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Statistics Bar */}
        <div className="mt-12 grid grid-cols-1 gap-6 delay-300 duration-500 animate-in fade-in slide-in-from-bottom-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-2 rounded-xl border bg-background p-6 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <stat.icon className="h-6 w-6 text-primary" />
              </div>
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-12 text-center delay-500 duration-500 animate-in fade-in">
          <p className="text-lg text-muted-foreground">See how easy it is to get started</p>
          <div className="mt-4">
            <Link href="/sign-up">
              <Button size="lg">Start Your Case</Button>
            </Link>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
