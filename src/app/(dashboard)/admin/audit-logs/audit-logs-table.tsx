'use client';

import { useCallback, useEffect, useState } from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { format } from 'date-fns';
import {
  Download,
  CheckCircle,
  AlertTriangle,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { AuditAction, AuditLog } from '@prisma/client';

interface AuditLogsTableProps {
  searchParams: {
    page?: string;
    userId?: string;
    caseId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  };
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ACTION_CATEGORIES: Record<string, AuditAction[]> = {
  Authentication: ['USER_REGISTERED', 'USER_LOGIN', 'USER_LOGOUT', 'USER_PROFILE_UPDATED'],
  KYC: ['KYC_INITIATED', 'KYC_COMPLETED', 'KYC_FAILED'],
  Case: [
    'CASE_CREATED',
    'CASE_UPDATED',
    'CASE_STATUS_CHANGED',
    'INVITATION_SENT',
    'INVITATION_VIEWED',
    'INVITATION_ACCEPTED',
    'INVITATION_EXPIRED',
  ],
  Agreement: ['AGREEMENT_VIEWED', 'AGREEMENT_SIGNED'],
  Evidence: ['EVIDENCE_UPLOADED', 'EVIDENCE_VIEWED', 'EVIDENCE_DELETED'],
  Statement: ['STATEMENT_SUBMITTED', 'STATEMENT_UPDATED'],
  Analysis: ['ANALYSIS_INITIATED', 'ANALYSIS_COMPLETED', 'ANALYSIS_FAILED'],
  Arbitrator: ['CASE_ASSIGNED', 'REVIEW_STARTED', 'REVIEW_COMPLETED', 'AWARD_SIGNED'],
  Award: ['AWARD_ISSUED', 'AWARD_DOWNLOADED', 'ENFORCEMENT_PACKAGE_DOWNLOADED'],
  Payment: ['PAYMENT_INITIATED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'REFUND_ISSUED'],
} as Record<string, AuditAction[]>;

const ACTION_BADGE_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  USER_REGISTERED: 'default',
  USER_LOGIN: 'secondary',
  USER_LOGOUT: 'outline',
  KYC_COMPLETED: 'default',
  KYC_FAILED: 'destructive',
  CASE_CREATED: 'default',
  PAYMENT_FAILED: 'destructive',
  ANALYSIS_FAILED: 'destructive',
};

export function AuditLogsTable({ searchParams }: AuditLogsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();

  const [data, setData] = useState<AuditLogsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<{
    isValid: boolean;
    totalLogs: number;
    invalidLogs: { id: string; reason: string }[];
  } | null>(null);

  // Filter states
  const [userIdFilter, setUserIdFilter] = useState(searchParams.userId ?? '');
  const [caseIdFilter, setCaseIdFilter] = useState(searchParams.caseId ?? '');
  const [actionFilter, setActionFilter] = useState(searchParams.action ?? 'all');

  const currentPage = parseInt(searchParams.page ?? '1', 10);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', '25');

      if (searchParams.userId) params.set('userId', searchParams.userId);
      if (searchParams.caseId) params.set('caseId', searchParams.caseId);
      if (searchParams.action && searchParams.action !== 'all') {
        params.set('action', searchParams.action);
      }
      if (searchParams.startDate) params.set('startDate', searchParams.startDate);
      if (searchParams.endDate) params.set('endDate', searchParams.endDate);

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (response.ok) {
        const result = (await response.json()) as { data: AuditLogsResponse };
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchParams]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const updateFilters = () => {
    const params = new URLSearchParams(urlSearchParams);
    params.set('page', '1');

    if (userIdFilter) {
      params.set('userId', userIdFilter);
    } else {
      params.delete('userId');
    }

    if (caseIdFilter) {
      params.set('caseId', caseIdFilter);
    } else {
      params.delete('caseId');
    }

    if (actionFilter && actionFilter !== 'all') {
      params.set('action', actionFilter);
    } else {
      params.delete('action');
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(urlSearchParams);
    params.set('page', newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const params = new URLSearchParams();
      params.set('format', format);

      if (searchParams.userId) params.set('userId', searchParams.userId);
      if (searchParams.caseId) params.set('caseId', searchParams.caseId);
      if (searchParams.action && searchParams.action !== 'all') {
        params.set('action', searchParams.action);
      }

      const response = await fetch(`/api/admin/audit-logs/export?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Audit logs exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export audit logs');
    }
  };

  const handleVerifyIntegrity = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch('/api/admin/audit-logs/verify');
      if (response.ok) {
        const result = (await response.json()) as {
          data: {
            isValid: boolean;
            totalLogs: number;
            invalidLogs: { id: string; reason: string }[];
          };
        };
        setIntegrityResult(result.data);

        if (result.data.isValid) {
          toast.success(`All ${result.data.totalLogs} logs verified successfully`);
        } else {
          toast.error(`Found ${result.data.invalidLogs.length} integrity issues`);
        }
      }
    } catch (error) {
      toast.error('Failed to verify integrity');
    } finally {
      setIsVerifying(false);
    }
  };

  const getActionBadgeVariant = (action: AuditAction) => {
    return ACTION_BADGE_VARIANTS[action] ?? 'secondary';
  };

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  if (isLoading && !data) {
    return <AuditLogsTableSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Integrity Check Result */}
      {integrityResult && (
        <Card className={integrityResult.isValid ? 'border-green-500' : 'border-red-500'}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {integrityResult.isValid ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Integrity Verified
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Integrity Issues Found
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {integrityResult.isValid
                ? `All ${integrityResult.totalLogs} audit logs passed integrity verification.`
                : `Found ${integrityResult.invalidLogs.length} logs with integrity issues out of ${integrityResult.totalLogs} total logs.`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="userIdFilter" className="mb-1 block">
                User ID
              </Label>
              <Input
                id="userIdFilter"
                placeholder="Filter by user ID..."
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
              />
            </div>

            <div className="min-w-[200px] flex-1">
              <Label htmlFor="caseIdFilter" className="mb-1 block">
                Case ID
              </Label>
              <Input
                id="caseIdFilter"
                placeholder="Filter by case ID..."
                value={caseIdFilter}
                onChange={(e) => setCaseIdFilter(e.target.value)}
              />
            </div>

            <div className="w-[200px]">
              <Label htmlFor="actionFilter" className="mb-1 block">
                Action
              </Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {Object.entries(ACTION_CATEGORIES).map(([category, actions]) => (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {category}
                      </div>
                      {actions.map((action) => (
                        <SelectItem key={action} value={action}>
                          {formatAction(action)}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={updateFilters}>
              <Filter className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>

            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => handleExport('csv')}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" onClick={() => handleExport('json')}>
                <Download className="mr-2 h-4 w-4" />
                JSON
              </Button>
              <Button variant="outline" onClick={handleVerifyIntegrity} disabled={isVerifying}>
                {isVerifying ? 'Verifying...' : 'Verify Integrity'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Case ID</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionBadgeVariant(log.action)}>
                      {formatAction(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.userId ? log.userId.substring(0, 8) + '...' : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.caseId ? log.caseId.substring(0, 8) + '...' : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.ipAddress ?? '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                    {log.metadata ? JSON.stringify(log.metadata) : '-'}
                  </TableCell>
                </TableRow>
              ))}

              {data?.logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No audit logs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(data.page - 1) * data.limit + 1} to{' '}
            {Math.min(data.page * data.limit, data.total)} of {data.total} logs
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {data.page} of {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= data.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Skeleton for loading state
function AuditLogsTableSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Case ID</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }, (_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }, (_, j) => (
                  <TableCell key={j}>
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
