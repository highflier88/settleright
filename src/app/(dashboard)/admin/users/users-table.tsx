import Link from 'next/link';

import { KYCStatus, type Prisma, UserRole } from '@prisma/client';
import { Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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
import { ROLE_DISPLAY_NAMES } from '@/lib/rbac';
import { formatDate } from '@/lib/utils';

interface UsersTableProps {
  searchParams: {
    page?: string;
    search?: string;
    role?: string;
    kycStatus?: string;
  };
}

const KYC_STATUS_LABELS: Record<KYCStatus, string> = {
  NOT_STARTED: 'Not Started',
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
};

const KYC_STATUS_VARIANTS: Record<KYCStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  NOT_STARTED: 'outline',
  PENDING: 'secondary',
  VERIFIED: 'default',
  FAILED: 'destructive',
  EXPIRED: 'destructive',
};

export async function UsersTable({ searchParams }: UsersTableProps) {
  const page = parseInt(searchParams.page ?? '1', 10);
  const perPage = 20;
  const search = searchParams.search;
  const roleFilter = searchParams.role && Object.values(UserRole).includes(searchParams.role as UserRole)
    ? (searchParams.role as UserRole)
    : undefined;
  const kycFilter = searchParams.kycStatus && Object.values(KYCStatus).includes(searchParams.kycStatus as KYCStatus)
    ? (searchParams.kycStatus as KYCStatus)
    : undefined;

  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (roleFilter) {
    where.role = roleFilter;
  }

  if (kycFilter) {
    where.identityVerification = {
      status: kycFilter,
    };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        identityVerification: {
          select: { status: true },
        },
        _count: {
          select: {
            casesAsClaimant: true,
            casesAsRespondent: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <form className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="search"
              placeholder="Search by email or name..."
              defaultValue={search}
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <div className="flex gap-2">
          <Select defaultValue={roleFilter ?? 'all'}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {Object.values(UserRole).map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_DISPLAY_NAMES[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select defaultValue={kycFilter ?? 'all'}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="KYC Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.values(KYCStatus).map((status) => (
                <SelectItem key={status} value={status}>
                  {KYC_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>KYC Status</TableHead>
              <TableHead>Cases</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{user.name ?? 'No name'}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROLE_DISPLAY_NAMES[user.role]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        KYC_STATUS_VARIANTS[
                          user.identityVerification?.status ?? KYCStatus.NOT_STARTED
                        ]
                      }
                    >
                      {
                        KYC_STATUS_LABELS[
                          user.identityVerification?.status ?? KYCStatus.NOT_STARTED
                        ]
                      }
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user._count.casesAsClaimant + user._count.casesAsRespondent}
                  </TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/users/${user.id}`}>
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
          Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of{' '}
          {total} users
        </p>
        <div className="flex gap-2">
          <Link
            href={`/admin/users?page=${page - 1}${search ? `&search=${search}` : ''}`}
          >
            <Button variant="outline" size="sm" disabled={page <= 1}>
              Previous
            </Button>
          </Link>
          <Link
            href={`/admin/users?page=${page + 1}${search ? `&search=${search}` : ''}`}
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
