import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  App,
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
} from 'firebase-admin';
import { Notification } from './schemas/notification.schema';
import { PushToken } from './schemas/push-token.schema';
import { User } from '../user/schemas/user.schema';

type MessagingClient = {
  sendEachForMulticast(message: Record<string, unknown>): Promise<{
    responses: Array<{ error?: { code?: string } }>;
  }>;
};

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
    @InjectModel(PushToken.name)
    private pushTokenModel: Model<PushToken>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    private configService: ConfigService,
  ) {
    this.messaging = this.configureFirebaseMessaging();
  }

  private readonly messaging?: MessagingClient;

  private getMessagingClient(app: App): MessagingClient | undefined {
    try {
      const modular = require('firebase-admin/messaging') as {
        getMessaging: (target?: App) => MessagingClient;
      };
      return modular.getMessaging(app);
    } catch {
      const legacy = require('firebase-admin') as {
        messaging?: (target?: App) => MessagingClient;
      };
      return legacy.messaging?.(app);
    }
  }

  private configureFirebaseMessaging(): MessagingClient | undefined {
    try {
      if (getApps().length > 0) {
        return this.getMessagingClient(getApp());
      }

      const projectId = this.configService
        .get<string>('FIREBASE_PROJECT_ID')
        ?.trim();
      const clientEmail = this.configService
        .get<string>('FIREBASE_CLIENT_EMAIL')
        ?.trim();
      const privateKey = this.configService
        .get<string>('FIREBASE_PRIVATE_KEY')
        ?.replace(/\\n/g, '\n')
        .trim();
      const applicationCredentials = this.configService
        .get<string>('GOOGLE_APPLICATION_CREDENTIALS')
        ?.trim();

      if (projectId && clientEmail && privateKey) {
        const app = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        return this.getMessagingClient(app);
      }
      if (applicationCredentials) {
        const app = initializeApp({
          credential: applicationDefault(),
        });
        return this.getMessagingClient(app);
      }
    } catch (error) {
      // Push delivery is optional at startup. Database notifications continue
      // to work, and configuration can be corrected without data loss.
      console.warn('Firebase messaging is unavailable:', error);
    }
    return undefined;
  }

  private async getProfileId(authId: string): Promise<Types.ObjectId> {
    const profile = await this.userModel
      .findOne({ authId: new Types.ObjectId(authId) })
      .select('_id');
    if (!profile) throw new NotFoundException('User profile not found');
    return profile._id as Types.ObjectId;
  }

  async registerPushToken(
    authId: string,
    token: string,
    platform: 'android' | 'ios',
  ) {
    const userId = await this.getProfileId(authId);
    await this.pushTokenModel.findOneAndUpdate(
      { token },
      {
        $set: {
          userId,
          platform,
          lastSeenAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return { registered: true };
  }

  async unregisterPushToken(authId: string, token: string) {
    const userId = await this.getProfileId(authId);
    await this.pushTokenModel.deleteOne({ userId, token });
    return { registered: false };
  }

  private async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data: Record<string, any>,
  ) {
    if (!this.messaging) return;
    const devices = await this.pushTokenModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('token')
      .lean();
    const tokens = devices.map((device) => device.token).filter(Boolean);
    if (tokens.length === 0) return;

    const response = await this.messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, String(value)]),
      ),
      android: {
        priority: 'high',
      },
      apns: { payload: { aps: { sound: 'default' } } },
    });

    const invalidTokens = response.responses.flatMap((result, index) => {
      const code = result.error?.code;
      return code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
        ? [tokens[index]]
        : [];
    });
    if (invalidTokens.length > 0) {
      await this.pushTokenModel.deleteMany({ token: { $in: invalidTokens } });
    }
  }

  /**
   * Create and send a notification
   */
  async createNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<Notification> {
    const notification = new this.notificationModel({
      userId: new Types.ObjectId(userId),
      type,
      title,
      body,
      data: data || {},
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    const saved = await notification.save();
    void this.sendPushNotification(userId, title, body, data || {}).catch(
      (error) => console.warn('Push notification delivery failed:', error),
    );
    return saved;
  }

  /**
   * Get unread notifications for a user
   */
  async getUnreadNotifications(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Notification[]; total: number }> {
    const userIdObj = new Types.ObjectId(userId);

    const total = await this.notificationModel.countDocuments({
      userId: userIdObj,
      isRead: false,
    });

    const data = await this.notificationModel
      .find({ userId: userIdObj, isRead: false })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Get all notifications for a user
   */
  async getAllNotifications(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Notification[]; total: number }> {
    const userIdObj = new Types.ObjectId(userId);

    const total = await this.notificationModel.countDocuments({
      userId: userIdObj,
    });

    const data = await this.notificationModel
      .find({ userId: userIdObj })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<Notification | null> {
    return this.notificationModel.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true },
    );
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { isRead: true },
    );
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    await this.notificationModel.findByIdAndDelete(notificationId);
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  /**
   * Bulk create notifications for multiple users
   */
  async createBulkNotifications(
    userIds: string[],
    type: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const notifications = userIds.map((userId) => ({
      userId: new Types.ObjectId(userId),
      type,
      title,
      body,
      data: data || {},
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }));

    await this.notificationModel.insertMany(notifications);
  }
}
