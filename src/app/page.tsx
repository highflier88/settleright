import { type Metadata } from 'next';

import {
  LandingHeader,
  HeroSection,
  ProblemSolutionSection,
  HowItWorksSection,
  FeaturesSection,
  TrustSection,
  PricingSection,
  FAQSection,
  CTASection,
  LandingFooter,
} from '@/components/landing';

export const metadata: Metadata = {
  title: 'Settleright.ai - AI-Powered Dispute Resolution',
  description:
    'Resolve disputes in days, not months. AI-powered binding arbitration that is legally enforceable, affordable, and 100% online. Skip the courtroom and get resolution faster.',
  keywords: [
    'online dispute resolution',
    'AI arbitration',
    'binding arbitration',
    'alternative dispute resolution',
    'ODR platform',
    'legal tech',
    'settle disputes online',
    'affordable arbitration',
  ],
  openGraph: {
    title: 'Settleright.ai - Resolve Disputes Quickly & Affordably',
    description:
      'AI-powered binding arbitration. Get legally enforceable decisions in days, not months.',
    type: 'website',
    siteName: 'Settleright.ai',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Settleright.ai - AI-Powered Dispute Resolution',
    description:
      'Resolve disputes in days with legally binding AI-assisted arbitration.',
  },
};

// JSON-LD Structured Data for SEO
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Settleright.ai',
  description: 'AI-powered binding arbitration for faster, affordable dispute resolution.',
  url: 'https://settleright.ai',
  logo: 'https://settleright.ai/project-logo-cropped-transparent.png',
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@settleright.ai',
    contactType: 'customer service',
  },
  sameAs: [],
};

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Online Dispute Resolution',
  provider: {
    '@type': 'Organization',
    name: 'Settleright.ai',
  },
  description: 'AI-powered binding arbitration for small claims disputes between $500 and $25,000.',
  serviceType: 'Binding Arbitration',
  areaServed: {
    '@type': 'Country',
    name: 'United States',
  },
  offers: {
    '@type': 'Offer',
    priceRange: '$49 - $249',
    priceCurrency: 'USD',
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is the decision legally binding?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Our arbitration awards are legally binding under the Federal Arbitration Act (FAA) and enforceable in court, just like any other arbitration decision.',
      },
    },
    {
      '@type': 'Question',
      name: 'How long does the process take?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Most cases are resolved within 2-4 weeks. After both parties sign the arbitration agreement, there is a 14-day evidence submission period, followed by AI analysis and arbitrator review.',
      },
    },
    {
      '@type': 'Question',
      name: 'What types of disputes can be resolved?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'We handle small claims disputes between $500 and $25,000, including consumer disputes, contract disagreements, property damage claims, service disputes, and debt collection matters.',
      },
    },
    {
      '@type': 'Question',
      name: 'How is AI used in the process?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'AI assists with analyzing submitted evidence, identifying key facts, and drafting preliminary findings. However, a human arbitrator reviews every case and makes the final decision.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is my information secure?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. We use bank-level encryption (AES-256) for all data, secure file storage, and follow industry best practices for data protection.',
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="flex min-h-screen flex-col">
        {/* Skip to main content - Accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none"
        >
          Skip to main content
        </a>

        <LandingHeader />
        <main id="main-content" className="flex-1">
          <HeroSection />
          <ProblemSolutionSection />
          <HowItWorksSection />
          <FeaturesSection />
          <TrustSection />
          <PricingSection />
          <FAQSection />
          <CTASection />
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
