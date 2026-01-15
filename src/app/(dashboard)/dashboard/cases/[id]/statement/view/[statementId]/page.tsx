import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ArrowLeft, FileText, Calendar, DollarSign, Edit } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthUser } from '@/lib/auth';
import { userHasAccessToCase, getCaseWithDetails } from '@/lib/services/case';
import { getStatementById, parseStatementContent } from '@/lib/services/statement';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'View Statement',
  description: 'View the full statement',
};

interface PageProps {
  params: { id: string; statementId: string };
}

export default async function ViewStatementPage({ params }: PageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect('/sign-in');
  }

  const access = await userHasAccessToCase(user.id, params.id);
  if (!access.hasAccess) {
    notFound();
  }

  const [caseData, statement] = await Promise.all([
    getCaseWithDetails(params.id),
    getStatementById(params.statementId),
  ]);

  if (!caseData || !statement || statement.caseId !== params.id) {
    notFound();
  }

  const content = parseStatementContent(statement);
  const isOwn = statement.submittedById === user.id;
  const canEdit = isOwn && caseData.status === 'EVIDENCE_SUBMISSION';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/cases/${params.id}/statement`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">
              {statement.type === 'INITIAL' ? 'Initial' : 'Rebuttal'} Statement
            </h1>
          </div>
          <p className="text-muted-foreground">Case {caseData.referenceNumber}</p>
        </div>
        {canEdit && (
          <Button variant="outline" asChild>
            <Link href={`/dashboard/cases/${params.id}/statement/edit/${statement.id}`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Statement
            </Link>
          </Button>
        )}
      </div>

      {/* Statement Meta */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Badge variant={isOwn ? 'default' : 'secondary'}>
                {isOwn ? 'Your Statement' : 'Other Party&apos;s Statement'}
              </Badge>
              <Badge variant="outline">Version {statement.version}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Submitted {new Date(statement.submittedAt).toLocaleDateString()} at{' '}
              {new Date(statement.submittedAt).toLocaleTimeString()}
              {statement.version > 1 && (
                <span className="ml-2">
                  (Updated {new Date(statement.updatedAt).toLocaleDateString()})
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Narrative */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Statement Narrative
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {content.narrative}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      {content.timeline && content.timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline of Events
            </CardTitle>
            <CardDescription>{content.timeline.length} event(s) documented</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-0">
              {content.timeline
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((entry, index) => (
                  <div key={entry.id} className="flex gap-4 pb-8 last:pb-0">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                      {index < content.timeline!.length - 1 && (
                        <div className="w-0.5 flex-1 bg-border" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-2">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          {new Date(entry.date).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-medium">{entry.title}</h4>
                      {entry.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Claim Items */}
      {content.claimItems && content.claimItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Claim Itemization
            </CardTitle>
            <CardDescription>{content.claimItems.length} item(s) claimed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {content.claimItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{item.description}</p>
                    <Badge variant="outline" className="mt-1">
                      {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                    </Badge>
                  </div>
                  <span className="font-semibold">
                    ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}

              {/* Total */}
              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted p-4">
                <span className="font-medium">Total Claimed</span>
                <span className="text-xl font-bold">
                  $
                  {content.claimItems
                    .reduce((sum, item) => sum + item.amount, 0)
                    .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Back Button */}
      <div className="flex justify-end">
        <Button variant="outline" asChild>
          <Link href={`/dashboard/cases/${params.id}/statement`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Statements
          </Link>
        </Button>
      </div>
    </div>
  );
}
