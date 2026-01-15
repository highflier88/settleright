'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const navLinks = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Trust', href: '#trust' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export function LandingHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);

      // Determine active section based on scroll position
      const sections = navLinks.map((link) => link.href.replace('#', ''));
      const scrollPosition = window.scrollY + 100;

      for (const section of sections.reverse()) {
        const element = document.getElementById(section);
        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(section);
          break;
        }
      }

      // If at top, clear active section
      if (window.scrollY < 100) {
        setActiveSection('');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        isScrolled
          ? 'border-b bg-background/95 backdrop-blur-md shadow-sm'
          : 'bg-background/80 backdrop-blur-sm'
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center transition-opacity hover:opacity-80">
          <Image
            src="/project-logo-cropped-transparent.png"
            alt="Settle Right.ai"
            width={180}
            height={40}
            className="h-8 w-auto"
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const isActive = activeSection === link.href.replace('#', '');
            return (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  'relative px-3 py-2 text-sm font-medium transition-colors rounded-md',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Desktop Auth Buttons */}
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm" className="gap-1">
              Get Started
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Mobile Menu */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="relative">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] p-0">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

            {/* Mobile Header */}
            <div className="flex items-center justify-between border-b p-4">
              <Link href="/" className="flex items-center">
                <Image
                  src="/project-logo-cropped-transparent.png"
                  alt="Settle Right.ai"
                  width={140}
                  height={31}
                  className="h-7 w-auto"
                />
              </Link>
              <SheetClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close menu</span>
                </Button>
              </SheetClose>
            </div>

            {/* Mobile Nav Links */}
            <nav className="flex flex-col p-4">
              {navLinks.map((link, index) => (
                <SheetClose asChild key={link.href}>
                  <a
                    href={link.href}
                    className={cn(
                      'flex items-center justify-between py-3 text-base font-medium transition-colors',
                      'border-b last:border-b-0',
                      activeSection === link.href.replace('#', '')
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {link.label}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </a>
                </SheetClose>
              ))}
            </nav>

            {/* Mobile Auth Buttons */}
            <div className="absolute bottom-0 left-0 right-0 border-t bg-muted/30 p-4">
              <div className="flex flex-col gap-3">
                <SheetClose asChild>
                  <Link href="/sign-up" className="w-full">
                    <Button className="w-full gap-1">
                      Get Started
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/sign-in" className="w-full">
                    <Button variant="outline" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                </SheetClose>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
