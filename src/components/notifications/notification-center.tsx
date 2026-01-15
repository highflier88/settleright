'use client';

import { useState, useEffect, useCallback } from 'react';

import { useRouter } from 'next/navigation';

import {
  Bell,
  CheckCheck,
  FileText,
  Users,
  Gavel,
  Clock,
  Shield,
  Mail,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  templateId: string;
  subject: string | null;
  body: string;
  sentAt: string;
  readAt: string | null;
}

interface NotificationCenterProps {
  initialUnreadCount?: number;
}

// Get icon for notification template
function getNotificationIcon(templateId: string) {
  if (templateId.includes('invitation')) return <Mail className="h-4 w-4" />;
  if (templateId.includes('agreement')) return <FileText className="h-4 w-4" />;
  if (templateId.includes('evidence')) return <FileText className="h-4 w-4" />;
  if (templateId.includes('statement')) return <FileText className="h-4 w-4" />;
  if (templateId.includes('deadline')) return <Clock className="h-4 w-4" />;
  if (templateId.includes('award')) return <Gavel className="h-4 w-4" />;
  if (templateId.includes('kyc')) return <Shield className="h-4 w-4" />;
  if (templateId.includes('welcome')) return <Users className="h-4 w-4" />;
  return <Bell className="h-4 w-4" />;
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function NotificationCenter({ initialUnreadCount = 0 }: NotificationCenterProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async (reset = false) => {
    setIsLoading(true);
    try {
      const offset = reset ? 0 : notifications.length;
      const response = await fetch(`/api/notifications?limit=20&offset=${offset}`);
      if (response.ok) {
        const data = (await response.json()) as {
          data: { notifications: Notification[]; unreadCount: number; hasMore: boolean };
        };
        setNotifications((prev) =>
          reset ? data.data.notifications : [...prev, ...data.data.notifications]
        );
        setUnreadCount(data.data.unreadCount);
        setHasMore(data.data.hasMore);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [notifications.length]);

  // Load notifications when popover opens
  useEffect(() => {
    if (isOpen && notifications.length === 0) {
      void fetchNotifications(true);
    }
  }, [isOpen, notifications.length, fetchNotifications]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
      });
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAllRead' }),
      });
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-medium">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs h-7"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification list */}
        <ScrollArea className="h-[400px]">
          {isLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  className={cn(
                    'flex gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors w-full text-left',
                    !notification.readAt && 'bg-primary/5'
                  )}
                  onClick={() => {
                    if (!notification.readAt) {
                      void markAsRead(notification.id);
                    }
                  }}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'flex-shrink-0 rounded-full p-2',
                      notification.readAt ? 'bg-muted' : 'bg-primary/10 text-primary'
                    )}
                  >
                    {getNotificationIcon(notification.templateId)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {notification.subject && (
                      <p className="text-sm font-medium truncate">{notification.subject}</p>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notification.body}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeTime(notification.sentAt)}
                    </p>
                  </div>

                  {/* Unread indicator */}
                  {!notification.readAt && (
                    <div className="flex-shrink-0">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    </div>
                  )}
                </button>
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="p-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => fetchNotifications(false)}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Loading...' : 'Load more'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <Separator />
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => {
              setIsOpen(false);
              router.push('/dashboard/settings?tab=notifications');
            }}
          >
            Notification Settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
