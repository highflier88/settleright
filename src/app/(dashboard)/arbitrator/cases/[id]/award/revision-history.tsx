'use client';

import { useState } from 'react';

import { History, ChevronDown, ChevronRight, User, Clock, FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface RevisionInfo {
  id: string;
  version: number;
  changeType: 'INITIAL' | 'ARBITRATOR_EDIT' | 'REGENERATION' | 'ESCALATION_EDIT';
  changeSummary: string | null;
  changedFields: string[];
  modifiedBy: {
    id: string;
    name: string | null;
    email: string;
  };
  createdAt: string;
}

interface RevisionHistoryProps {
  revisions: RevisionInfo[];
  currentVersion: number;
  onViewRevision?: (revisionId: string) => void;
}

const CHANGE_TYPE_LABELS: Record<RevisionInfo['changeType'], { label: string; color: string }> = {
  INITIAL: { label: 'Initial Draft', color: 'bg-slate-500' },
  ARBITRATOR_EDIT: { label: 'Arbitrator Edit', color: 'bg-blue-500' },
  REGENERATION: { label: 'Regenerated', color: 'bg-amber-500' },
  ESCALATION_EDIT: { label: 'Senior Review', color: 'bg-purple-500' },
};

export function RevisionHistory({
  revisions,
  currentVersion,
  onViewRevision,
}: RevisionHistoryProps) {
  const [expandedRevisions, setExpandedRevisions] = useState<Set<string>>(new Set());

  const toggleRevision = (revisionId: string) => {
    setExpandedRevisions((prev) => {
      const next = new Set(prev);
      if (next.has(revisionId)) {
        next.delete(revisionId);
      } else {
        next.add(revisionId);
      }
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  if (revisions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Revision History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No revisions yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Revision History
        </CardTitle>
        <CardDescription>
          {revisions.length} version{revisions.length !== 1 ? 's' : ''} - Current: v{currentVersion}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {revisions.map((revision, _index) => {
          const isExpanded = expandedRevisions.has(revision.id);
          const isCurrent = revision.version === currentVersion;
          const changeTypeInfo = CHANGE_TYPE_LABELS[revision.changeType];

          return (
            <Collapsible
              key={revision.id}
              open={isExpanded}
              onOpenChange={() => toggleRevision(revision.id)}
            >
              <div
                className={`rounded-lg border ${isCurrent ? 'border-primary bg-primary/5' : ''}`}
              >
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="flex items-center gap-2">
                        <span className="font-medium">v{revision.version}</span>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <Badge className={`${changeTypeInfo.color} text-xs text-white`}>
                        {changeTypeInfo.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDate(revision.createdAt)}
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="space-y-3 border-t px-3 pb-3 pt-0">
                    {/* Modified By */}
                    <div className="flex items-center gap-2 pt-3 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Modified by:</span>
                      <span className="font-medium">
                        {revision.modifiedBy.name || revision.modifiedBy.email}
                      </span>
                    </div>

                    {/* Changed Fields */}
                    {revision.changedFields.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-sm text-muted-foreground">Changed fields:</span>
                        <div className="flex flex-wrap gap-1">
                          {revision.changedFields.map((field) => (
                            <Badge key={field} variant="outline" className="text-xs">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Change Summary */}
                    {revision.changeSummary && (
                      <div className="space-y-1">
                        <span className="text-sm text-muted-foreground">Summary:</span>
                        <p className="rounded bg-muted/50 p-2 text-sm">{revision.changeSummary}</p>
                      </div>
                    )}

                    {/* View Revision Button */}
                    {onViewRevision && !isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewRevision(revision.id)}
                        className="mt-2"
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        View This Version
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
