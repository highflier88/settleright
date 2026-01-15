import Image from 'next/image';
import Link from 'next/link';

import {
  Mail,
  Scale,
  Shield,
  Lock,
  FileSignature,
  ArrowRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

const productLinks = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Trust & Security', href: '#trust' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const legalLinks = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Arbitration Rules', href: '/legal/arbitration-rules' },
  { label: 'Cookie Policy', href: '/legal/cookies' },
];

const companyLinks = [
  { label: 'About Us', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Blog', href: '/blog' },
];

const trustBadges = [
  { label: 'FAA Compliant', icon: Scale },
  { label: 'AES-256 Encrypted', icon: Lock },
  { label: 'ESIGN Compliant', icon: FileSignature },
  { label: 'SOC 2', icon: Shield },
];

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      {/* Main Footer Content */}
      <div className="container py-12 md:py-16">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Brand Column */}
          <div className="lg:col-span-4">
            <Link href="/" className="inline-flex items-center">
              <Image
                src="/project-logo-cropped-transparent.png"
                alt="Settle Right.ai"
                width={160}
                height={35}
                className="h-8 w-auto"
              />
            </Link>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-xs">
              AI-powered binding arbitration for faster, affordable dispute resolution.
              Resolve your disputes in weeks, not months.
            </p>

            {/* Contact Email */}
            <div className="mt-6">
              <a
                href="mailto:support@settleright.ai"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4" />
                support@settleright.ai
              </a>
            </div>

            {/* CTA */}
            <div className="mt-6">
              <Link href="/sign-up">
                <Button size="sm" className="gap-1">
                  Start Your Case
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Links Columns */}
          <div className="grid gap-8 sm:grid-cols-3 lg:col-span-8">
            {/* Product Column */}
            <div>
              <h4 className="text-sm font-semibold mb-4">Product</h4>
              <nav className="flex flex-col gap-3">
                {productLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>

            {/* Company Column */}
            <div>
              <h4 className="text-sm font-semibold mb-4">Company</h4>
              <nav className="flex flex-col gap-3">
                {companyLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Legal Column */}
            <div>
              <h4 className="text-sm font-semibold mb-4">Legal</h4>
              <nav className="flex flex-col gap-3">
                {legalLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 pt-8 border-t">
          <div className="flex flex-wrap items-center justify-center gap-6">
            {trustBadges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <badge.icon className="h-4 w-4" />
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t bg-muted/50">
        <div className="container py-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-muted-foreground">
              &copy; {currentYear} Settleright.ai. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                All systems operational
              </span>
              <span>•</span>
              <span>Powered by AI. Reviewed by humans.</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
