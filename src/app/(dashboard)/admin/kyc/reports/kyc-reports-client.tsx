'use client';

import { useState } from 'react';

import { Download, FileJson, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { KYCStatus } from '@/types/shared';

interface ReportData {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    total: number;
    success: number;
    failed: number;
    pending: number;
    expired: number;
    notStarted: number;
    successRate: number;
    avgVerificationTimeHours: number | null;
  };
  byStatus: Record<KYCStatus, number>;
  byDocumentType: Array<{ type: string; count: number }>;
  failureReasons: Array<{ reason: string; count: number }>;
  dailyStats: Array<{
    date: string;
    verified: number;
    failed: number;
    initiated: number;
  }>;
}

const KYC_STATUSES: KYCStatus[] = ['NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED'];

const KYC_STATUS_LABELS: Record<KYCStatus, string> = {
  NOT_STARTED: 'Not Started',
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
};

export function KYCReportsClient() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);

  // Report generation form
  const [reportStartDate, setReportStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [reportEndDate, setReportEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Export form
  const [exportStatus, setExportStatus] = useState<KYCStatus | 'all'>('all');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  const handleGenerateReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      toast.error('Please select a date range');
      return;
    }

    setIsGenerating(true);
    setReport(null);

    try {
      const response = await fetch('/api/admin/kyc/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: new Date(reportStartDate).toISOString(),
          endDate: new Date(reportEndDate).toISOString(),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Failed to generate report');
      }

      const data = (await response.json()) as { data: ReportData };
      setReport(data.data);
      toast.success('Report generated successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);

    try {
      const params = new URLSearchParams();
      params.set('format', format);
      if (exportStatus !== 'all') {
        params.set('status', exportStatus);
      }
      if (exportStartDate) {
        params.set('startDate', new Date(exportStartDate).toISOString());
      }
      if (exportEndDate) {
        params.set('endDate', new Date(exportEndDate).toISOString());
      }

      const response = await fetch(`/api/admin/kyc/export?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      // Get the blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kyc-verifications-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Export downloaded successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Generate Report Card */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Compliance Report</CardTitle>
            <CardDescription>
              Create a comprehensive report for a specific date range
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reportStartDate">Start Date</Label>
                <Input
                  id="reportStartDate"
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportEndDate">End Date</Label>
                <Input
                  id="reportEndDate"
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Report
            </Button>
          </CardContent>
        </Card>

        {/* Export Data Card */}
        <Card>
          <CardHeader>
            <CardTitle>Export Verification Records</CardTitle>
            <CardDescription>
              Download verification data in CSV or JSON format
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Filter by Status</Label>
              <Select
                value={exportStatus}
                onValueChange={(v) => setExportStatus(v as KYCStatus | 'all')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {KYC_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {KYC_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="exportStartDate">Start Date (optional)</Label>
                <Input
                  id="exportStartDate"
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exportEndDate">End Date (optional)</Label>
                <Input
                  id="exportEndDate"
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleExport('csv')}
                disabled={isExporting}
                className="flex-1"
              >
                <FileText className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport('json')}
                disabled={isExporting}
                className="flex-1"
              >
                <FileJson className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Results */}
      {report && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Report Summary</CardTitle>
              <CardDescription>
                {new Date(report.period.startDate).toLocaleDateString()} -{' '}
                {new Date(report.period.endDate).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Total Verifications</p>
                  <p className="text-2xl font-bold">{report.summary.total}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {report.summary.successRate}%
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Verified</p>
                  <p className="text-2xl font-bold text-green-600">{report.summary.success}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{report.summary.failed}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{report.summary.pending}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Expired</p>
                  <p className="text-2xl font-bold text-orange-600">{report.summary.expired}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Not Started</p>
                  <p className="text-2xl font-bold text-gray-600">{report.summary.notStarted}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Avg. Verification Time</p>
                  <p className="text-2xl font-bold">
                    {report.summary.avgVerificationTimeHours
                      ? `${report.summary.avgVerificationTimeHours}h`
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Document Types */}
            <Card>
              <CardHeader>
                <CardTitle>By Document Type</CardTitle>
              </CardHeader>
              <CardContent>
                {report.byDocumentType.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data</p>
                ) : (
                  <div className="space-y-2">
                    {report.byDocumentType.map(({ type, count }) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm capitalize">
                          {type.replace(/_/g, ' ')}
                        </span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Failure Reasons */}
            <Card>
              <CardHeader>
                <CardTitle>Top Failure Reasons</CardTitle>
              </CardHeader>
              <CardContent>
                {report.failureReasons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No failures recorded</p>
                ) : (
                  <div className="space-y-2">
                    {report.failureReasons.slice(0, 10).map(({ reason, count }) => (
                      <div key={reason} className="flex items-center justify-between">
                        <span className="text-sm">{reason}</span>
                        <span className="font-medium text-red-600">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Daily Stats */}
          {report.dailyStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Daily Activity</CardTitle>
                <CardDescription>Verification activity by day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b">
                        <th className="py-2 text-left font-medium">Date</th>
                        <th className="py-2 text-right font-medium">Initiated</th>
                        <th className="py-2 text-right font-medium text-green-600">Verified</th>
                        <th className="py-2 text-right font-medium text-red-600">Failed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.dailyStats.map(({ date, initiated, verified, failed }) => (
                        <tr key={date} className="border-b">
                          <td className="py-2">{new Date(date).toLocaleDateString()}</td>
                          <td className="py-2 text-right">{initiated}</td>
                          <td className="py-2 text-right text-green-600">{verified}</td>
                          <td className="py-2 text-right text-red-600">{failed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Download Report Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                const blob = new Blob([JSON.stringify(report, null, 2)], {
                  type: 'application/json',
                });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `kyc-compliance-report-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Report as JSON
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
