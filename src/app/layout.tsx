import '@/styles/globals.css';

import { type Metadata, type Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { ConditionalClerkProvider } from '@/components/providers/conditional-clerk-provider';

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'Settleright.ai - AI-Powered Dispute Resolution',
    template: '%s | Settleright.ai',
  },
  description:
    'Resolve disputes quickly and affordably with AI-powered binding arbitration. Get legally enforceable decisions without going to court.',
  keywords: [
    'dispute resolution',
    'arbitration',
    'online dispute resolution',
    'ODR',
    'AI arbitration',
    'legal tech',
    'binding arbitration',
  ],
  authors: [{ name: 'Settleright.ai' }],
  creator: 'Settleright.ai',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://settleright.ai'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://settleright.ai',
    siteName: 'Settleright.ai',
    title: 'Settleright.ai - AI-Powered Dispute Resolution',
    description:
      'Resolve disputes quickly and affordably with AI-powered binding arbitration. Get legally enforceable decisions without going to court.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Settleright.ai - AI-Powered Dispute Resolution',
    description:
      'Resolve disputes quickly and affordably with AI-powered binding arbitration. Get legally enforceable decisions without going to court.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConditionalClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={cn(
            'min-h-screen bg-background font-sans antialiased',
            fontSans.variable,
            fontMono.variable
          )}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <QueryProvider>
              {children}
              <Toaster />
            </QueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ConditionalClerkProvider>
  );
}
