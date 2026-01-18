import { Badge } from '@/components/ui/badge';
import type { KYCStatus } from '@/types/shared';

interface KYCStatusBadgeProps {
  status: KYCStatus;
}

const STATUS_CONFIG: Record<
  KYCStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  NOT_STARTED: { label: 'Not Started', variant: 'outline' },
  PENDING: { label: 'Pending', variant: 'secondary' },
  VERIFIED: { label: 'Verified', variant: 'default' },
  FAILED: { label: 'Failed', variant: 'destructive' },
  EXPIRED: { label: 'Expired', variant: 'destructive' },
};

export function KYCStatusBadge({ status }: KYCStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
