'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { NotificationPreference } from '@prisma/client';

interface NotificationsFormProps {
  preferences: NotificationPreference;
}

export function NotificationsForm({ preferences }: NotificationsFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [prefs, setPrefs] = useState({
    emailEnabled: preferences.emailEnabled,
    smsEnabled: preferences.smsEnabled,
    inAppEnabled: preferences.inAppEnabled,
    caseUpdates: preferences.caseUpdates,
    deadlineReminders: preferences.deadlineReminders,
    evidenceUploads: preferences.evidenceUploads,
    awardNotifications: preferences.awardNotifications,
    marketingEmails: preferences.marketingEmails,
  });

  const handleToggle = (key: keyof typeof prefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/user/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to save preferences');
      }

      toast.success('Notification preferences saved');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive updates via email
              </p>
            </div>
            <Switch
              id="email"
              checked={prefs.emailEnabled}
              onCheckedChange={() => handleToggle('emailEnabled')}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sms">SMS Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive updates via text message
              </p>
            </div>
            <Switch
              id="sms"
              checked={prefs.smsEnabled}
              onCheckedChange={() => handleToggle('smsEnabled')}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="inApp">In-App Notifications</Label>
              <p className="text-sm text-muted-foreground">
                See notifications in the dashboard
              </p>
            </div>
            <Switch
              id="inApp"
              checked={prefs.inAppEnabled}
              onCheckedChange={() => handleToggle('inAppEnabled')}
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
          <CardDescription>
            Choose what you want to be notified about
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="caseUpdates">Case Updates</Label>
              <p className="text-sm text-muted-foreground">
                Status changes and important case events
              </p>
            </div>
            <Switch
              id="caseUpdates"
              checked={prefs.caseUpdates}
              onCheckedChange={() => handleToggle('caseUpdates')}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="deadlineReminders">Deadline Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Reminders for upcoming submission deadlines
              </p>
            </div>
            <Switch
              id="deadlineReminders"
              checked={prefs.deadlineReminders}
              onCheckedChange={() => handleToggle('deadlineReminders')}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="evidenceUploads">Evidence Uploads</Label>
              <p className="text-sm text-muted-foreground">
                When the other party uploads new evidence
              </p>
            </div>
            <Switch
              id="evidenceUploads"
              checked={prefs.evidenceUploads}
              onCheckedChange={() => handleToggle('evidenceUploads')}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="awardNotifications">Award Notifications</Label>
              <p className="text-sm text-muted-foreground">
                When an arbitration award is issued
              </p>
            </div>
            <Switch
              id="awardNotifications"
              checked={prefs.awardNotifications}
              onCheckedChange={() => handleToggle('awardNotifications')}
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marketing</CardTitle>
          <CardDescription>
            Promotional communications and updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="marketingEmails">Marketing Emails</Label>
              <p className="text-sm text-muted-foreground">
                Product updates, tips, and promotional offers
              </p>
            </div>
            <Switch
              id="marketingEmails"
              checked={prefs.marketingEmails}
              onCheckedChange={() => handleToggle('marketingEmails')}
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading} isLoading={isLoading}>
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
