import Link from 'next/link';

import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/utils';
import type { KYCStatus } from '@/types/shared';

import { KYCStatusBadge } from './kyc-status-badge';

interface KYCTableProps {
  searchParams: {
    page?: string;
    search?: string;
    status?: string;
  };
}

interface VerificationWithUser {
  id: string;
  userId: string;
  status: KYCStatus;
  verifiedName: string | null;
  verifiedAt: Date | null;
  expiresAt: Date | null;
  failedAt: Date | null;
  failureCount: number;
  createdAt: Date;
  user: {
    email: string;
    name: string | null;
  };
  _count: {
    adminActions: number;
  };
}

const KYC_STATUSES: KYCStatus[] = ['NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED'];

const KYC_STATUS_LABELS: Record<KYCStatus, string> = {
  NOT_STARTED: 'Not Started',
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
};

export async function KYCTable({ searchParams }: KYCTableProps) {
  const page = parseInt(searchParams.page ?? '1', 10);
  const perPage = 20;
  const search = searchParams.search;
  const statusFilter =
    searchParams.status && KYC_STATUSES.includes(searchParams.status as KYCStatus)
      ? (searchParams.status as KYCStatus)
      : undefined;

  const where: Record<string, unknown> = {};

  if (search) {
    where.user = {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  if (statusFilter) {
    where.status = statusFilter;
  }

  const [verificationsResult, total] = await Promise.all([
    prisma.identityVerification.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        _count: {
          select: {
            adminActions: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.identityVerification.count({ where }),
  ]);
  const verifications = verificationsResult as VerificationWithUser[];

  const totalPages = Math.ceil(total / perPage);

  const buildUrl = (params: Record<string, string | undefined>) => {
    const url = new URLSearchParams();
    if (params.page && params.page !== '1') url.set('page', params.page);
    if (params.search) url.set('search', params.search);
    if (params.status && params.status !== 'all') url.set('status', params.status);
    const queryString = url.toString();
    return `/admin/kyc${queryString ? `?${queryString}` : ''}`;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <form className="flex flex-1 items-center gap-2" action="/admin/kyc" method="get">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="search"
              placeholder="Search by email or name..."
              defaultValue={search}
              className="pl-8"
            />
          </div>
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <Select defaultValue={statusFilter ?? 'all'}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <Link href={buildUrl({ search, status: undefined })} className="block w-full">
                All Status
              </Link>
            </SelectItem>
            {KYC_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                <Link href={buildUrl({ search, status })} className="block w-full">
                  {KYC_STATUS_LABELS[status]}
                </Link>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verified Name</TableHead>
              <TableHead>Verified/Failed Date</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Failures</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {verifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No verifications found
                </TableCell>
              </TableRow>
            ) : (
              verifications.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{v.user.name ?? 'No name'}</p>
                      <p className="text-sm text-muted-foreground">{v.user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <KYCStatusBadge status={v.status} />
                  </TableCell>
                  <TableCell>{v.verifiedName ?? '-'}</TableCell>
                  <TableCell>
                    {v.verifiedAt
                      ? formatDate(v.verifiedAt)
                      : v.failedAt
                        ? formatDate(v.failedAt)
                        : '-'}
                  </TableCell>
                  <TableCell>
                    {v.expiresAt ? (
                      <span
                        className={
                          new Date(v.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                            ? 'text-orange-600 dark:text-orange-400'
                            : ''
                        }
                      >
                        {formatDate(v.expiresAt)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {v.failureCount > 0 && (
                      <span className="text-red-600 dark:text-red-400">{v.failureCount}</span>
                    )}
                    {v.failureCount === 0 && '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/kyc/${v.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total}{' '}
          verifications
        </p>
        <div className="flex gap-2">
          <Link
            href={buildUrl({
              page: String(page - 1),
              search,
              status: statusFilter,
            })}
          >
            <Button variant="outline" size="sm" disabled={page <= 1}>
              Previous
            </Button>
          </Link>
          <Link
            href={buildUrl({
              page: String(page + 1),
              search,
              status: statusFilter,
            })}
          >
            <Button variant="outline" size="sm" disabled={page >= totalPages}>
              Next
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
