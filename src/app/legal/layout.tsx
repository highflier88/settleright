import Link from 'next/link';

import { ArrowLeft } from 'lucide-react';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settleright.ai
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 md:py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Settleright.ai. All rights reserved.
            </p>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <Link
                href="/legal/terms-of-service"
                className="transition-colors hover:text-foreground"
              >
                Terms
              </Link>
              <Link
                href="/legal/privacy-policy"
                className="transition-colors hover:text-foreground"
              >
                Privacy
              </Link>
              <Link
                href="/legal/procedural-rules"
                className="transition-colors hover:text-foreground"
              >
                Arbitration Rules
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
