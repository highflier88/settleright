'use client';

import { useState } from 'react';

import Link from 'next/link';

import {
  Scale,
  Clock,
  FileText,
  Shield,
  HelpCircle,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { SectionWrapper } from './section-wrapper';

interface FAQ {
  question: string;
  answer: string;
}

interface FAQCategory {
  name: string;
  icon: LucideIcon;
  faqs: FAQ[];
}

const faqCategories: FAQCategory[] = [
  {
    name: 'Legal & Binding',
    icon: Scale,
    faqs: [
      {
        question: 'Is the decision legally binding?',
        answer:
          'Yes. Our arbitration awards are legally binding under the Federal Arbitration Act (FAA) and enforceable in court, just like any other arbitration decision. Both parties agree to binding arbitration before the process begins.',
      },
      {
        question: 'How do I enforce the award?',
        answer:
          'If the losing party does not comply with the award voluntarily, you can petition a local court to confirm the arbitration award. Once confirmed, it becomes a court judgment that can be enforced through standard collection procedures.',
      },
      {
        question: 'Can I appeal the decision?',
        answer:
          'Binding arbitration has limited appeal rights by design—this is what makes it faster and more final than court. Appeals are only possible in rare circumstances, such as fraud or arbitrator misconduct, as defined by the Federal Arbitration Act.',
      },
    ],
  },
  {
    name: 'Process & Timeline',
    icon: Clock,
    faqs: [
      {
        question: 'How long does the process take?',
        answer:
          'Most cases are resolved within 2-4 weeks. After both parties sign the arbitration agreement, there is a 14-day evidence submission period, followed by AI analysis and arbitrator review. Simple cases may resolve even faster.',
      },
      {
        question: 'What types of disputes can be resolved?',
        answer:
          'We handle small claims disputes between $500 and $25,000, including consumer disputes, contract disagreements, property damage claims, service disputes, and debt collection matters. We do not handle family law, criminal matters, or cases requiring injunctive relief.',
      },
      {
        question: "What if the other party doesn't respond?",
        answer:
          'If the respondent does not accept the invitation within the specified timeframe, default procedures apply. The arbitrator may issue a default award based on the evidence provided by the claimant, similar to a default judgment in court.',
      },
      {
        question: 'How is AI used in the process?',
        answer:
          'AI assists with analyzing submitted evidence, identifying key facts, and drafting preliminary findings. However, a human arbitrator reviews every case and makes the final decision. The AI helps ensure thorough analysis while the human provides professional judgment.',
      },
    ],
  },
  {
    name: 'Evidence & Documents',
    icon: FileText,
    faqs: [
      {
        question: 'What evidence can I submit?',
        answer:
          'You can submit documents (contracts, receipts, invoices), photographs, screenshots of communications, videos, and written statements. All evidence is securely stored and shared with the other party for review.',
      },
      {
        question: 'What payment methods are accepted?',
        answer:
          'We accept all major credit and debit cards through our secure payment processor, Stripe. Payment is required when filing your case. We do not currently accept payment plans, checks, or cash.',
      },
    ],
  },
  {
    name: 'Security & Privacy',
    icon: Shield,
    faqs: [
      {
        question: 'Is my information secure?',
        answer:
          'Yes. We use bank-level encryption (AES-256) for all data, secure file storage, and follow industry best practices for data protection. Your case information is confidential and only accessible to the parties involved and the assigned arbitrator.',
      },
    ],
  },
];

// Flatten FAQs for "All" view
const allFaqs = faqCategories.flatMap((cat) => cat.faqs);

export function FAQSection() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const displayedFaqs = activeCategory
    ? (faqCategories.find((cat) => cat.name === activeCategory)?.faqs ?? [])
    : allFaqs;

  return (
    <SectionWrapper id="faq">
      <div className="mx-auto max-w-4xl">
        {/* Section Header */}
        <div className="mb-12 text-center duration-500 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to know about online arbitration
          </p>
        </div>

        {/* Category Filter */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2 delay-100 duration-500 animate-in fade-in slide-in-from-bottom-4">
          <Button
            variant={activeCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(null)}
            className="gap-2"
          >
            <HelpCircle className="h-4 w-4" />
            All
          </Button>
          {faqCategories.map((category) => (
            <Button
              key={category.name}
              variant={activeCategory === category.name ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(category.name)}
              className="gap-2"
            >
              <category.icon className="h-4 w-4" />
              {category.name}
            </Button>
          ))}
        </div>

        {/* FAQ Accordion */}
        <div className="rounded-xl border bg-background p-6 delay-200 duration-500 animate-in fade-in slide-in-from-bottom-4 md:p-8">
          <Accordion type="single" collapsible className="w-full">
            {displayedFaqs.map((faq, index) => (
              <AccordionItem
                key={`${activeCategory}-${index}`}
                value={`item-${index}`}
                className={cn(
                  'animate-in fade-in slide-in-from-bottom-2',
                  index === displayedFaqs.length - 1 && 'border-b-0'
                )}
                style={{ animationDelay: `${(index + 1) * 50}ms` }}
              >
                <AccordionTrigger className="py-5 text-left transition-colors hover:text-primary">
                  <span className="pr-4">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-5 leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-2 gap-4 delay-300 duration-500 animate-in fade-in slide-in-from-bottom-4 sm:grid-cols-4">
          {[
            { label: 'Questions Answered', value: `${allFaqs.length}` },
            { label: 'Response Time', value: '< 24hrs' },
            { label: 'Support', value: 'Email' },
            { label: 'Help Center', value: 'Coming Soon' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-lg font-semibold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Still Have Questions CTA */}
        <div className="mt-12 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center delay-500 duration-500 animate-in fade-in slide-in-from-bottom-4">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <MessageCircle className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">Still have questions?</h3>
          <p className="mt-2 text-muted-foreground">
            We&apos;re here to help. Reach out and we&apos;ll get back to you within 24 hours.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/contact">
              <Button variant="default" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                Contact Us
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button variant="outline">Start Your Case</Button>
            </Link>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
