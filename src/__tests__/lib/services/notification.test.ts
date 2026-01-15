/**
 * Notification Service Tests
 *
 * Tests for notification management and delivery.
 */

import { prisma } from '@/lib/db';
import {
  NotificationTemplates,
  getUserNotificationPreferences,
  updateNotificationPreferences,
  createInAppNotification,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteOldNotifications,
  getNotificationStats,
} from '@/lib/services/notification';

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    notificationPreference: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    notification: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Notification Templates
  // ==========================================================================

  describe('NotificationTemplates', () => {
    it('should define case lifecycle templates', () => {
      expect(NotificationTemplates.CASE_CREATED).toBe('case_created');
      expect(NotificationTemplates.INVITATION_SENT).toBe('invitation_sent');
      expect(NotificationTemplates.INVITATION_ACCEPTED).toBe('invitation_accepted');
    });

    it('should define agreement templates', () => {
      expect(NotificationTemplates.AGREEMENT_READY).toBe('agreement_ready');
      expect(NotificationTemplates.AGREEMENT_COMPLETE).toBe('agreement_complete');
    });

    it('should define award templates', () => {
      expect(NotificationTemplates.DRAFT_AWARD_READY).toBe('draft_award_ready');
      expect(NotificationTemplates.AWARD_ISSUED).toBe('award_issued');
    });

    it('should define deadline templates', () => {
      expect(NotificationTemplates.DEADLINE_24H_WARNING).toBe('deadline_24h_warning');
      expect(NotificationTemplates.DEADLINE_PASSED).toBe('deadline_passed');
    });
  });

  // ==========================================================================
  // Notification Preferences
  // ==========================================================================

  describe('getUserNotificationPreferences', () => {
    it('should return existing preferences', async () => {
      const mockPrefs = {
        userId: 'user-123',
        emailEnabled: true,
        smsEnabled: false,
        inAppEnabled: true,
        caseUpdates: true,
        deadlineReminders: true,
        evidenceUploads: true,
        awardNotifications: true,
        marketingEmails: false,
      };

      (mockPrisma.notificationPreference.findUnique as jest.Mock).mockResolvedValue(mockPrefs);

      const result = await getUserNotificationPreferences('user-123');

      expect(result).toEqual(mockPrefs);
      expect(mockPrisma.notificationPreference.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('should create default preferences if none exist', async () => {
      const defaultPrefs = {
        userId: 'user-123',
        emailEnabled: true,
        smsEnabled: true,
        inAppEnabled: true,
        caseUpdates: true,
        deadlineReminders: true,
        evidenceUploads: true,
        awardNotifications: true,
        marketingEmails: false,
      };

      (mockPrisma.notificationPreference.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.notificationPreference.create as jest.Mock).mockResolvedValue(defaultPrefs);

      const result = await getUserNotificationPreferences('user-123');

      expect(result).toEqual(defaultPrefs);
      expect(mockPrisma.notificationPreference.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          emailEnabled: true,
          smsEnabled: true,
          inAppEnabled: true,
          marketingEmails: false,
        }),
      });
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update preferences using upsert', async () => {
      const updates = { emailEnabled: false, smsEnabled: false };
      const updatedPrefs = {
        userId: 'user-123',
        ...updates,
      };

      (mockPrisma.notificationPreference.upsert as jest.Mock).mockResolvedValue(updatedPrefs);

      const result = await updateNotificationPreferences('user-123', updates);

      expect(result).toEqual(updatedPrefs);
      expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        update: updates,
        create: expect.objectContaining({
          userId: 'user-123',
          ...updates,
        }),
      });
    });

    it('should allow partial updates', async () => {
      (mockPrisma.notificationPreference.upsert as jest.Mock).mockResolvedValue({});

      await updateNotificationPreferences('user-123', { marketingEmails: true });

      expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { marketingEmails: true },
        })
      );
    });
  });

  // ==========================================================================
  // In-App Notifications
  // ==========================================================================

  describe('createInAppNotification', () => {
    it('should create a notification and return its ID', async () => {
      const mockNotification = {
        id: 'notif-123',
        userId: 'user-123',
        type: 'IN_APP',
        templateId: 'case_created',
        body: 'Your case has been created',
        sentAt: new Date(),
      };

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);

      const result = await createInAppNotification({
        userId: 'user-123',
        type: 'IN_APP',
        templateId: 'case_created',
        body: 'Your case has been created',
      });

      expect(result).toBe('notif-123');
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          type: 'IN_APP',
          templateId: 'case_created',
          body: 'Your case has been created',
          sentAt: expect.any(Date),
        }),
      });
    });

    it('should include subject when provided', async () => {
      (mockPrisma.notification.create as jest.Mock).mockResolvedValue({ id: 'notif-123' });

      await createInAppNotification({
        userId: 'user-123',
        type: 'IN_APP',
        templateId: 'award_issued',
        subject: 'Award Issued',
        body: 'The award has been issued',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subject: 'Award Issued',
        }),
      });
    });
  });

  describe('getUserNotifications', () => {
    it('should return paginated notifications', async () => {
      const mockNotifications = [
        { id: 'n1', body: 'Notification 1', readAt: null },
        { id: 'n2', body: 'Notification 2', readAt: new Date() },
      ];

      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue(mockNotifications);
      (mockPrisma.notification.count as jest.Mock)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(5); // unread

      const result = await getUserNotifications('user-123');

      expect(result.notifications).toEqual(mockNotifications);
      expect(result.total).toBe(10);
      expect(result.unreadCount).toBe(5);
      expect(result.hasMore).toBe(true);
    });

    it('should filter by unread only when requested', async () => {
      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.notification.count as jest.Mock).mockResolvedValue(0);

      await getUserNotifications('user-123', { unreadOnly: true });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ readAt: null }),
        })
      );
    });

    it('should respect pagination options', async () => {
      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.notification.count as jest.Mock).mockResolvedValue(0);

      await getUserNotifications('user-123', { limit: 25, offset: 50 });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
          skip: 50,
        })
      );
    });

    it('should correctly calculate hasMore', async () => {
      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([{ id: 'n1' }]);
      (mockPrisma.notification.count as jest.Mock)
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(0); // unread

      const result = await getUserNotifications('user-123', { limit: 50 });

      expect(result.hasMore).toBe(false);
    });
  });

  // ==========================================================================
  // Mark as Read
  // ==========================================================================

  describe('markNotificationRead', () => {
    it('should mark notification as read', async () => {
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue({
        id: 'notif-123',
        userId: 'user-123',
      });
      (mockPrisma.notification.update as jest.Mock).mockResolvedValue({});

      const result = await markNotificationRead('notif-123', 'user-123');

      expect(result).toBe(true);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-123' },
        data: { readAt: expect.any(Date) },
      });
    });

    it('should return false if notification not found', async () => {
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await markNotificationRead('notif-123', 'user-123');

      expect(result).toBe(false);
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });

    it('should return false if notification belongs to different user', async () => {
      (mockPrisma.notification.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await markNotificationRead('notif-123', 'user-456');

      expect(result).toBe(false);
    });
  });

  describe('markAllNotificationsRead', () => {
    it('should mark all unread notifications as read', async () => {
      (mockPrisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

      const result = await markAllNotificationsRead('user-123');

      expect(result).toBe(5);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          type: 'IN_APP',
          readAt: null,
        },
        data: { readAt: expect.any(Date) },
      });
    });

    it('should return 0 if no unread notifications', async () => {
      (mockPrisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const result = await markAllNotificationsRead('user-123');

      expect(result).toBe(0);
    });
  });

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  describe('deleteOldNotifications', () => {
    it('should delete notifications older than specified days', async () => {
      (mockPrisma.notification.deleteMany as jest.Mock).mockResolvedValue({ count: 10 });

      const result = await deleteOldNotifications(90);

      expect(result).toBe(10);
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          sentAt: { lt: expect.any(Date) },
          readAt: { not: null },
        },
      });
    });

    it('should use default of 90 days', async () => {
      (mockPrisma.notification.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

      await deleteOldNotifications();

      expect(mockPrisma.notification.deleteMany).toHaveBeenCalled();
    });

    it('should only delete read notifications', async () => {
      (mockPrisma.notification.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

      await deleteOldNotifications(30);

      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          readAt: { not: null },
        }),
      });
    });
  });

  // ==========================================================================
  // Statistics
  // ==========================================================================

  describe('getNotificationStats', () => {
    it('should return notification statistics', async () => {
      (mockPrisma.notification.count as jest.Mock)
        .mockResolvedValueOnce(20) // total
        .mockResolvedValueOnce(8); // unread

      (mockPrisma.notification.groupBy as jest.Mock).mockResolvedValue([
        { templateId: 'case_created', _count: 5 },
        { templateId: 'award_issued', _count: 3 },
      ]);

      const result = await getNotificationStats('user-123');

      expect(result).toEqual({
        total: 20,
        unread: 8,
        read: 12,
        byTemplate: {
          case_created: 5,
          award_issued: 3,
        },
      });
    });

    it('should handle empty notification history', async () => {
      (mockPrisma.notification.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.notification.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await getNotificationStats('user-123');

      expect(result).toEqual({
        total: 0,
        unread: 0,
        read: 0,
        byTemplate: {},
      });
    });
  });
});
