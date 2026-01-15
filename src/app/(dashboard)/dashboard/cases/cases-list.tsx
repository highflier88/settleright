'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

import { format } from 'date-fns';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Filter,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { CaseStatus, DisputeType, InvitationStatus } from '@prisma/client';

interface CaseListItem {
  id: string;
  referenceNumber: string;
  status: CaseStatus;
  disputeType: DisputeType;
  jurisdiction: string;
  description: string;
  amount: string;
  createdAt: string;
  responseDeadline: string | null;
  claimant: {
    id: string;
    name: string | null;
    email: string;
  };
  respondent: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  invitation: {
    status: InvitationStatus;
    email: string;
  } | null;
}

interface CasesListProps {
  userId: string;
  searchParams: {
    page?: string;
    status?: string;
    role?: string;
  };
}

interface CasesResponse {
  cases: CaseListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats?: {
    totalCases: number;
    activeCases: number;
    decidedCases: number;
    closedCases: number;
    totalAmountClaimed: number;
  };
}

const STATUS_CONFIG: Record<
  CaseStatus,
  { label: string; icon: typeof Clock; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  DRAFT: { label: 'Draft', icon: FileText, variant: 'outline' },
  PENDING_RESPONDENT: { label: 'Awaiting Respondent', icon: Clock, variant: 'secondary' },
  PENDING_AGREEMENT: { label: 'Pending Agreement', icon: Clock, variant: 'secondary' },
  EVIDENCE_SUBMISSION: { label: 'Evidence Phase', icon: FileText, variant: 'default' },
  ANALYSIS_PENDING: { label: 'Analysis Pending', icon: Clock, variant: 'secondary' },
  ANALYSIS_IN_PROGRESS: { label: 'Analyzing', icon: Clock, variant: 'secondary' },
  ARBITRATOR_REVIEW: { label: 'Arbitrator Review', icon: Clock, variant: 'secondary' },
  DECIDED: { label: 'Decided', icon: CheckCircle, variant: 'default' },
  CLOSED: { label: 'Closed', icon: CheckCircle, variant: 'outline' },
};

const DISPUTE_TYPE_LABELS: Record<DisputeType, string> = {
  CONTRACT: 'Contract',
  PAYMENT: 'Payment',
  SERVICE: 'Service',
  GOODS: 'Goods',
  OTHER: 'Other',
};

export function CasesList({ userId, searchParams }: CasesListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();

  const [data, setData] = useState<CasesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState(searchParams.status ?? 'all');
  const [roleFilter, setRoleFilter] = useState(searchParams.role ?? 'all');

  useEffect(() => {
    async function fetchCases() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', searchParams.page ?? '1');
        params.set('limit', '10');
        params.set('includeStats', 'true');

        if (searchParams.status && searchParams.status !== 'all') {
          params.set('status', searchParams.status);
        }
        if (searchParams.role && searchParams.role !== 'all') {
          params.set('role', searchParams.role);
        }

        const response = await fetch(`/api/cases?${params.toString()}`);
        if (response.ok) {
          const result = (await response.json()) as { data: CasesResponse };
          setData(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch cases:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchCases();
  }, [searchParams]);

  const applyFilters = () => {
    const params = new URLSearchParams(urlSearchParams);
    params.set('page', '1');

    if (statusFilter && statusFilter !== 'all') {
      params.set('status', statusFilter);
    } else {
      params.delete('status');
    }

    if (roleFilter && roleFilter !== 'all') {
      params.set('role', roleFilter);
    } else {
      params.delete('role');
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(urlSearchParams);
    params.set('page', newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  if (isLoading) {
    return <CasesListSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {data?.stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Cases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.totalCases}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Cases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{data.stats.activeCases}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Decided
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{data.stats.decidedCases}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Claimed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${data.stats.totalAmountClaimed.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-[180px]">
              <label htmlFor="status-filter" className="text-sm font-medium mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[180px]">
              <label htmlFor="role-filter" className="text-sm font-medium mb-1 block">My Role</label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger id="role-filter">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="claimant">Claimant</SelectItem>
                  <SelectItem value="respondent">Respondent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={applyFilters} variant="secondary">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cases List */}
      <div className="space-y-4">
        {data?.cases.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No cases found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You don&apos;t have any cases yet. Start a new case to begin.
              </p>
              <Button asChild className="mt-4">
                <Link href="/dashboard/cases/new">Start New Case</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          data?.cases.map((caseItem) => {
            const statusConfig = STATUS_CONFIG[caseItem.status];
            const StatusIcon = statusConfig.icon;
            const isClaimant = caseItem.claimant.id === userId;
            const otherParty = isClaimant ? caseItem.respondent : caseItem.claimant;

            return (
              <Link key={caseItem.id} href={`/dashboard/cases/${caseItem.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-medium">
                            {caseItem.referenceNumber}
                          </span>
                          <Badge variant={statusConfig.variant}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                          <Badge variant="outline">
                            {DISPUTE_TYPE_LABELS[caseItem.disputeType]}
                          </Badge>
                          <Badge variant={isClaimant ? 'default' : 'secondary'}>
                            {isClaimant ? 'Claimant' : 'Respondent'}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {caseItem.description}
                        </p>

                        <div className="flex items-center gap-6 text-sm">
                          <span>
                            <span className="text-muted-foreground">Amount:</span>{' '}
                            <span className="font-medium">
                              ${Number(caseItem.amount).toLocaleString()}
                            </span>
                          </span>
                          <span>
                            <span className="text-muted-foreground">
                              {isClaimant ? 'Respondent:' : 'Claimant:'}
                            </span>{' '}
                            {otherParty ? (
                              <span>{otherParty.name ?? otherParty.email}</span>
                            ) : caseItem.invitation ? (
                              <span className="text-amber-600">
                                {caseItem.invitation.email} (invited)
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </span>
                          <span>
                            <span className="text-muted-foreground">Filed:</span>{' '}
                            {format(new Date(caseItem.createdAt), 'MMM d, yyyy')}
                          </span>
                        </div>

                        {caseItem.responseDeadline &&
                          caseItem.status === 'PENDING_RESPONDENT' && (
                            <div className="flex items-center gap-2 text-sm text-amber-600">
                              <AlertTriangle className="h-4 w-4" />
                              Response deadline:{' '}
                              {format(new Date(caseItem.responseDeadline), 'MMM d, yyyy')}
                            </div>
                          )}
                      </div>

                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(data.page - 1) * data.limit + 1} to{' '}
            {Math.min(data.page * data.limit, data.total)} of {data.total} cases
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(data.page - 1)}
              disabled={data.page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {data.page} of {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(data.page + 1)}
              disabled={data.page >= data.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Skeleton component
export function CasesListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-20 animate-pulse bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="h-5 w-24 animate-pulse bg-muted rounded" />
                  <div className="h-5 w-20 animate-pulse bg-muted rounded" />
                </div>
                <div className="h-4 w-full animate-pulse bg-muted rounded" />
                <div className="h-4 w-2/3 animate-pulse bg-muted rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
