import type { Metadata } from 'next';

import { KYCReportsClient } from './kyc-reports-client';

export const metadata: Metadata = {
  title: 'KYC Compliance Reports',
  description: 'Generate and export KYC compliance reports',
};

export default function KYCReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">KYC Compliance Reports</h1>
        <p className="text-muted-foreground">
          Generate compliance reports and export verification records
        </p>
      </div>

      <KYCReportsClient />
    </div>
  );
}
