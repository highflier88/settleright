'use client';

import { useEffect, useState } from 'react';

import { Activity, FileText, Shield, Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AuditStatsData {
  totalLogs: number;
  logsByAction: Record<string, number>;
  logsByDay: { date: string; count: number }[];
  uniqueUsers: number;
  uniqueIPs: number;
}

export function AuditStats() {
  const [stats, setStats] = useState<AuditStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/admin/audit-logs/stats?days=30');
        if (response.ok) {
          const data = (await response.json()) as { data: AuditStatsData };
          setStats(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch audit stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 animate-pulse bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // Calculate auth events
  const authEvents =
    (stats.logsByAction['USER_LOGIN'] ?? 0) +
    (stats.logsByAction['USER_LOGOUT'] ?? 0) +
    (stats.logsByAction['USER_REGISTERED'] ?? 0);

  // Calculate KYC events
  const kycEvents =
    (stats.logsByAction['KYC_INITIATED'] ?? 0) +
    (stats.logsByAction['KYC_COMPLETED'] ?? 0) +
    (stats.logsByAction['KYC_FAILED'] ?? 0);

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalLogs.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Last 30 days</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.uniqueUsers.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Active in logs</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Auth Events</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{authEvents.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Login/logout/register</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">KYC Events</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kycEvents.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Identity verifications</p>
        </CardContent>
      </Card>
    </div>
  );
}
