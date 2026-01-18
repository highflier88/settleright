import { notFound } from 'next/navigation';

import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Shield,
  User,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/utils';

import { KYCOverrideDialog } from '../components/kyc-override-dialog';
import { KYCStatusBadge } from '../components/kyc-status-badge';
import { AddNoteForm } from './add-note-form';

import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `KYC Verification ${id}`,
    description: 'View and manage KYC verification details',
  };
}

const ACTION_TYPE_LABELS = {
  MANUAL_OVERRIDE: 'Status Override',
  NOTE_ADDED: 'Note Added',
  EXPIRATION_EXTENDED: 'Expiration Extended',
  VERIFICATION_REVOKED: 'Verification Revoked',
};

const REMINDER_TYPE_LABELS = {
  THIRTY_DAYS: '30-Day Warning',
  FOURTEEN_DAYS: '14-Day Warning',
  SEVEN_DAYS: '7-Day Warning',
  EXPIRED: 'Expired Notice',
};

export default async function KYCDetailPage({ params }: PageProps) {
  const { id } = await params;

  const verification = await prisma.identityVerification.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          createdAt: true,
        },
      },
      adminActions: {
        orderBy: { createdAt: 'desc' },
      },
      reminders: {
        orderBy: { sentAt: 'desc' },
      },
    },
  });

  if (!verification) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/kyc">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">KYC Verification</h1>
            <p className="text-muted-foreground">
              {verification.user.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <KYCStatusBadge status={verification.status} />
          <KYCOverrideDialog
            verificationId={verification.id}
            currentStatus={verification.status}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium">{verification.user.name ?? 'Not set'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{verification.user.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{verification.user.phone ?? 'Not set'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Account Created</p>
                <p className="font-medium">{formatDate(verification.user.createdAt)}</p>
              </div>
            </div>
            <div>
              <Link href={`/admin/users/${verification.user.id}`}>
                <Button variant="outline" size="sm">
                  View Full Profile
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Verification Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Verification Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <KYCStatusBadge status={verification.status} />
              </div>
              <div>
                <p className="text-muted-foreground">Provider</p>
                <p className="font-medium">{verification.provider ?? 'Stripe Identity'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Document Type</p>
                <p className="font-medium">
                  {verification.documentType?.replace(/_/g, ' ') ?? 'Not verified'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Verified Name</p>
                <p className="font-medium">{verification.verifiedName ?? 'Not verified'}</p>
              </div>
              {verification.verifiedDob && (
                <div>
                  <p className="text-muted-foreground">Verified DOB</p>
                  <p className="font-medium">{formatDate(verification.verifiedDob)}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Failure Count</p>
                <p className="font-medium">
                  {verification.failureCount > 0 ? (
                    <span className="text-red-600">{verification.failureCount}</span>
                  ) : (
                    '0'
                  )}
                </p>
              </div>
            </div>
            {verification.failureReason && (
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Last Failure Reason
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {verification.failureReason}
                </p>
                {verification.lastFailureCode && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    Code: {verification.lastFailureCode}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span>{formatDate(verification.createdAt)}</span>
              </div>
              {verification.initiatedAt && (
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span className="text-muted-foreground">Initiated:</span>
                  <span>{formatDate(verification.initiatedAt)}</span>
                </div>
              )}
              {verification.verifiedAt && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-muted-foreground">Verified:</span>
                  <span>{formatDate(verification.verifiedAt)}</span>
                </div>
              )}
              {verification.failedAt && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-muted-foreground">Failed:</span>
                  <span>{formatDate(verification.failedAt)}</span>
                </div>
              )}
              {verification.expiresAt && (
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className={`h-4 w-4 ${
                      new Date(verification.expiresAt) < new Date()
                        ? 'text-red-500'
                        : new Date(verification.expiresAt) <
                            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                          ? 'text-orange-500'
                          : 'text-muted-foreground'
                    }`}
                  />
                  <span className="text-muted-foreground">Expires:</span>
                  <span
                    className={
                      new Date(verification.expiresAt) < new Date()
                        ? 'text-red-600 dark:text-red-400'
                        : new Date(verification.expiresAt) <
                            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                          ? 'text-orange-600 dark:text-orange-400'
                          : ''
                    }
                  >
                    {formatDate(verification.expiresAt)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reminders Sent Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Reminders Sent
            </CardTitle>
            <CardDescription>Expiration reminders sent to the user</CardDescription>
          </CardHeader>
          <CardContent>
            {verification.reminders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reminders sent yet</p>
            ) : (
              <div className="space-y-2">
                {verification.reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between rounded-md border p-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {REMINDER_TYPE_LABELS[reminder.reminderType as keyof typeof REMINDER_TYPE_LABELS]}
                      </Badge>
                      {reminder.emailSent ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <span className="text-muted-foreground">{formatDate(reminder.sentAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Admin Notes Section */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Notes</CardTitle>
          <CardDescription>Add notes and view the audit history for this verification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddNoteForm verificationId={verification.id} />
        </CardContent>
      </Card>

      {/* Admin Actions History */}
      <Card>
        <CardHeader>
          <CardTitle>Audit History</CardTitle>
          <CardDescription>All administrative actions taken on this verification</CardDescription>
        </CardHeader>
        <CardContent>
          {verification.adminActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin actions recorded</p>
          ) : (
            <div className="space-y-4">
              {verification.adminActions.map((action) => (
                <div key={action.id} className="border-l-2 border-muted pl-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {ACTION_TYPE_LABELS[action.actionType as keyof typeof ACTION_TYPE_LABELS]}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(action.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{action.reason}</p>
                  {action.previousStatus && action.newStatus && (
                    <p className="text-sm text-muted-foreground">
                      Status changed: {action.previousStatus} → {action.newStatus}
                    </p>
                  )}
                  {action.notes && (
                    <p className="mt-1 rounded-md bg-muted p-2 text-sm">{action.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
