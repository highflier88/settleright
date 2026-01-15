import {
  Scale,
  ShieldCheck,
  FileSignature,
  Clock,
  Lock,
  Server,
  UserCheck,
  Award,
  BadgeCheck,
  Building,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { SectionWrapper } from './section-wrapper';

interface LegalFeature {
  title: string;
  description: string;
  icon: LucideIcon;
}

interface SecurityBadge {
  title: string;
  description: string;
  icon: LucideIcon;
}

interface Commitment {
  title: string;
  description: string;
  icon: LucideIcon;
}

const legalFeatures: LegalFeature[] = [
  {
    title: 'FAA Compliant',
    description:
      'Our arbitration process fully complies with the Federal Arbitration Act, ensuring nationwide enforceability.',
    icon: Scale,
  },
  {
    title: 'Court Enforceable',
    description:
      'Awards can be confirmed by any court and enforced like traditional judgments through standard legal procedures.',
    icon: Building,
  },
  {
    title: 'ESIGN & UETA Compliant',
    description:
      'Digital signatures meet all federal and state requirements for legally binding electronic agreements.',
    icon: FileSignature,
  },
  {
    title: 'RFC 3161 Timestamps',
    description:
      'Cryptographic timestamps provide tamper-proof evidence of when documents were signed and submitted.',
    icon: Clock,
  },
];

const securityBadges: SecurityBadge[] = [
  {
    title: 'AES-256 Encryption',
    description: 'Bank-level encryption for all data at rest and in transit',
    icon: Lock,
  },
  {
    title: 'Secure Cloud Storage',
    description: 'Enterprise-grade infrastructure with redundant backups',
    icon: Server,
  },
  {
    title: 'Privacy Compliant',
    description: 'GDPR and CCPA compliant data handling practices',
    icon: ShieldCheck,
  },
];

const arbitratorCredentials = [
  'Licensed attorneys or retired judges',
  'Specialized ADR training and certification',
  'Ongoing continuing education requirements',
  'Bound by strict ethical guidelines',
];

const commitments: Commitment[] = [
  {
    title: 'Resolution in Weeks, Not Months',
    description: 'Our streamlined process targets 2-4 week resolution for most cases.',
    icon: Zap,
  },
  {
    title: 'Transparent Process',
    description: 'Clear timelines, fair procedures, and no hidden fees at any stage.',
    icon: Target,
  },
  {
    title: 'Modern Legal Tech',
    description: 'Built with the latest technology to make dispute resolution accessible.',
    icon: Sparkles,
  },
];

export function TrustSection() {
  return (
    <SectionWrapper id="trust" background="muted">
      <div className="mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="mb-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Built on Trust & Legal Validity
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Our platform meets the highest standards for legal compliance, security, and professional arbitration.
          </p>
        </div>

        {/* Legal Validity Grid */}
        <div className="mb-12">
          <div className="flex items-center justify-center gap-2 mb-8">
            <Scale className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-semibold">Legal Validity</h3>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {legalFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className={cn(
                  'group rounded-xl border bg-background p-6 transition-all duration-300',
                  'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5',
                  'animate-in fade-in slide-in-from-bottom-4',
                )}
                style={{ animationDelay: `${(index + 1) * 100}ms` }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors duration-300 group-hover:bg-primary/15">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-semibold transition-colors duration-300 group-hover:text-primary">
                  {feature.title}
                </h4>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Security & Arbitrator Row */}
        <div className="grid gap-8 lg:grid-cols-2 mb-12">
          {/* Security Section */}
          <div className="rounded-xl border bg-background p-6 md:p-8 animate-in fade-in slide-in-from-left-4 duration-500 delay-300">
            <div className="flex items-center gap-2 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Enterprise Security</h3>
            </div>
            <div className="space-y-4">
              {securityBadges.map((badge) => (
                <div
                  key={badge.title}
                  className="flex items-start gap-4 rounded-lg p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <badge.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{badge.title}</p>
                    <p className="text-sm text-muted-foreground">{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Arbitrator Credentials */}
          <div className="rounded-xl border bg-background p-6 md:p-8 animate-in fade-in slide-in-from-right-4 duration-500 delay-300">
            <div className="flex items-center gap-2 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Professional Arbitrators</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              Every case is reviewed by a qualified human arbitrator who makes the final decision.
            </p>
            <div className="space-y-3">
              {arbitratorCredentials.map((credential, index) => (
                <div
                  key={credential}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm">{credential}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-2 rounded-lg bg-muted/50 p-4">
              <Award className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium">Human + AI Collaboration</p>
                <p className="text-xs text-muted-foreground">
                  AI assists with analysis, humans make the decisions
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Our Commitment */}
        <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
          <h3 className="text-center text-lg font-semibold mb-8">Our Commitment to You</h3>
          <div className="grid gap-6 sm:grid-cols-3">
            {commitments.map((commitment, index) => (
              <div
                key={commitment.title}
                className={cn(
                  'flex flex-col items-center text-center px-4',
                  index < commitments.length - 1 && 'sm:border-r sm:border-primary/20'
                )}
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <commitment.icon className="h-7 w-7 text-primary" />
                </div>
                <h4 className="font-semibold">{commitment.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{commitment.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trust Badges Row */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-center animate-in fade-in duration-500 delay-700">
          <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>256-bit SSL</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm">
            <Lock className="h-4 w-4 text-primary" />
            <span>SOC 2 Compliant</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm">
            <Scale className="h-4 w-4 text-primary" />
            <span>FAA Compliant</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm">
            <FileSignature className="h-4 w-4 text-primary" />
            <span>ESIGN Compliant</span>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
