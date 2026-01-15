import {
  Brain,
  Gavel,
  PenLine,
  FolderUp,
  LayoutDashboard,
  ShieldCheck,
  Smartphone,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { SectionWrapper } from './section-wrapper';

interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
}

const features: Feature[] = [
  {
    title: 'AI-Powered Analysis',
    description:
      'Advanced AI reviews your case thoroughly, identifying key facts and legal issues faster than manual processing.',
    icon: Brain,
  },
  {
    title: 'Human Arbitrator Oversight',
    description:
      'Every decision is reviewed and signed by a qualified human arbitrator ensuring fair, professional judgment.',
    icon: Gavel,
  },
  {
    title: 'Digital Signatures',
    description:
      'Secure, legally valid e-signatures captured instantly. ESIGN Act and UETA compliant for full enforceability.',
    icon: PenLine,
  },
  {
    title: 'Evidence Management',
    description:
      'Easy upload and organization of documents, photos, and communications. All evidence securely stored.',
    icon: FolderUp,
  },
  {
    title: 'Real-time Status Tracking',
    description:
      'Monitor your case progress 24/7 with a clear dashboard showing every milestone and deadline.',
    icon: LayoutDashboard,
  },
  {
    title: 'Bank-Level Security',
    description:
      'AES-256 encryption protects all data. Your case information remains confidential and secure.',
    icon: ShieldCheck,
  },
  {
    title: 'Mobile Friendly',
    description:
      'File and manage your case from any device. Full functionality on phone, tablet, or desktop.',
    icon: Smartphone,
  },
  {
    title: 'Clear Deadlines',
    description:
      'Know exactly when evidence submissions and responses are due. No guessing, no surprises.',
    icon: CalendarClock,
  },
];

export function FeaturesSection() {
  return (
    <SectionWrapper id="features">
      <div className="mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="mb-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Why Choose Settleright.ai?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Modern dispute resolution designed for speed, fairness, and enforceability.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={cn(
                'group relative rounded-xl border bg-background p-6 transition-all duration-300',
                'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5',
                'animate-in fade-in slide-in-from-bottom-4',
              )}
              style={{ animationDelay: `${(index + 1) * 75}ms` }}
            >
              {/* Icon with Glow */}
              <div className="relative mb-4">
                <div className="absolute inset-0 h-14 w-14 rounded-xl bg-primary/10 blur-md transition-all duration-300 group-hover:bg-primary/20 group-hover:blur-lg" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 transition-all duration-300 group-hover:bg-primary/15">
                  <feature.icon className="h-7 w-7 text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold transition-colors duration-300 group-hover:text-primary">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>

              {/* Subtle corner accent on hover */}
              <div className="absolute right-0 top-0 h-16 w-16 overflow-hidden rounded-tr-xl">
                <div className="absolute -right-8 -top-8 h-16 w-16 rotate-45 bg-gradient-to-br from-primary/0 to-primary/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Highlight */}
        <div className="mt-16 text-center animate-in fade-in duration-500 delay-700">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>All features included with every filing</span>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
