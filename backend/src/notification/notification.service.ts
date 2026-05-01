import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification } from './schemas/notification.schema';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
  ) {}

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

    return notification.save();
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
