'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Bell, Mail, MessageSquare, Smartphone, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  caseUpdates: boolean;
  deadlineReminders: boolean;
  evidenceUploads: boolean;
  awardNotifications: boolean;
  marketingEmails: boolean;
}

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch preferences on mount
  useEffect(() => {
    async function fetchPreferences() {
      try {
        const response = await fetch('/api/notifications/preferences');
        if (response.ok) {
          const data = await response.json();
          setPreferences(data.data.preferences);
        }
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
        toast.error('Failed to load notification preferences');
      } finally {
        setIsLoading(false);
      }
    }

    void fetchPreferences();
  }, []);

  // Update a preference
  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return;

    // Optimistic update
    setPreferences((prev) => (prev ? { ...prev, [key]: value } : null));
    setIsSaving(true);

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      toast.success('Preferences updated');
    } catch (error) {
      // Revert on error
      setPreferences((prev) => (prev ? { ...prev, [key]: !value } : null));
      toast.error('Failed to update preferences');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!preferences) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Failed to load notification preferences
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="emailEnabled" className="text-base cursor-pointer">
                  Email Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
            </div>
            <Switch
              id="emailEnabled"
              checked={preferences.emailEnabled}
              onCheckedChange={(checked) => updatePreference('emailEnabled', checked)}
              disabled={isSaving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="smsEnabled" className="text-base cursor-pointer">
                  SMS Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive urgent notifications via text message
                </p>
              </div>
            </div>
            <Switch
              id="smsEnabled"
              checked={preferences.smsEnabled}
              onCheckedChange={(checked) => updatePreference('smsEnabled', checked)}
              disabled={isSaving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="inAppEnabled" className="text-base cursor-pointer">
                  In-App Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  See notifications in your dashboard
                </p>
              </div>
            </div>
            <Switch
              id="inAppEnabled"
              checked={preferences.inAppEnabled}
              onCheckedChange={(checked) => updatePreference('inAppEnabled', checked)}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
          <CardDescription>
            Choose which types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="caseUpdates" className="text-base cursor-pointer">
                Case Updates
              </Label>
              <p className="text-sm text-muted-foreground">
                Invitations, agreement signing, case status changes
              </p>
            </div>
            <Switch
              id="caseUpdates"
              checked={preferences.caseUpdates}
              onCheckedChange={(checked) => updatePreference('caseUpdates', checked)}
              disabled={isSaving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="deadlineReminders" className="text-base cursor-pointer">
                Deadline Reminders
              </Label>
              <p className="text-sm text-muted-foreground">
                Reminders before evidence and statement deadlines
              </p>
            </div>
            <Switch
              id="deadlineReminders"
              checked={preferences.deadlineReminders}
              onCheckedChange={(checked) => updatePreference('deadlineReminders', checked)}
              disabled={isSaving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="evidenceUploads" className="text-base cursor-pointer">
                Evidence Uploads
              </Label>
              <p className="text-sm text-muted-foreground">
                When the other party uploads new evidence
              </p>
            </div>
            <Switch
              id="evidenceUploads"
              checked={preferences.evidenceUploads}
              onCheckedChange={(checked) => updatePreference('evidenceUploads', checked)}
              disabled={isSaving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="awardNotifications" className="text-base cursor-pointer">
                Award Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                When an arbitration award is issued
              </p>
            </div>
            <Switch
              id="awardNotifications"
              checked={preferences.awardNotifications}
              onCheckedChange={(checked) => updatePreference('awardNotifications', checked)}
              disabled={isSaving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="marketingEmails" className="text-base cursor-pointer">
                Marketing Emails
              </Label>
              <p className="text-sm text-muted-foreground">
                Product updates and announcements
              </p>
            </div>
            <Switch
              id="marketingEmails"
              checked={preferences.marketingEmails}
              onCheckedChange={(checked) => updatePreference('marketingEmails', checked)}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
