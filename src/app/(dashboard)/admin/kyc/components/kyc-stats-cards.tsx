import { AlertTriangle, CheckCircle, Clock, Shield, Users, XCircle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface KYCStats {
  total: number;
  byStatus: {
    NOT_STARTED: number;
    PENDING: number;
    VERIFIED: number;
    FAILED: number;
    EXPIRED: number;
  };
  expiringSoon: number;
  recentFailures: number;
  averageVerificationTime: number | null;
}

interface KYCStatsCardsProps {
  stats: KYCStats;
}

export function KYCStatsCards({ stats }: KYCStatsCardsProps) {
  const successRate =
    stats.total > 0
      ? ((stats.byStatus.VERIFIED / stats.total) * 100).toFixed(1)
      : '0';

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Verifications</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">
            {stats.byStatus.NOT_STARTED} not started
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Verified</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.byStatus.VERIFIED}</div>
          <p className="text-xs text-muted-foreground">{successRate}% success rate</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <Clock className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.byStatus.PENDING}</div>
          <p className="text-xs text-muted-foreground">Awaiting completion</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Failed/Expired</CardTitle>
          <XCircle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.byStatus.FAILED + stats.byStatus.EXPIRED}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.recentFailures} failed in last 7 days
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.expiringSoon}</div>
          <p className="text-xs text-muted-foreground">Within 30 days</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg. Verification Time</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.averageVerificationTime !== null
              ? `${stats.averageVerificationTime.toFixed(1)}h`
              : 'N/A'}
          </div>
          <p className="text-xs text-muted-foreground">From start to verified</p>
        </CardContent>
      </Card>
    </div>
  );
}
