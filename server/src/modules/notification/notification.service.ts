import { Types, type ClientSession } from "mongoose";
import Notification, { type NotificationType } from "../../models/Notification";
import User, { type UserRole } from "../../models/User";

export const notifyOrganizationRoles = async (
  organizationId: Types.ObjectId,
  roles: UserRole[],
  deliveryId: Types.ObjectId,
  type: NotificationType,
  title: string,
  message: string,
  session?: ClientSession
) => {
  const usersQuery = User.find({
    organizationId,
    role: { $in: roles },
    accountStatus: "active",
    emailVerified: true,
  }).select("_id").lean();
  if (session) usersQuery.session(session);
  const recipients = await usersQuery;
  if (!recipients.length) return;

  const notifications = recipients.map((recipient) => ({
    recipientId: recipient._id,
    organizationId,
    deliveryId,
    type,
    title,
    message,
  }));
  if (session) {
    await Notification.insertMany(notifications, { session });
  } else {
    await Notification.insertMany(notifications);
  }
};

export const notifySupplier = async (
  supplierId: Types.ObjectId,
  organizationId: Types.ObjectId,
  deliveryId: Types.ObjectId,
  type: NotificationType,
  title: string,
  message: string,
  session?: ClientSession
) => {
  await Notification.create(
    [{
      recipientId: supplierId,
      organizationId,
      deliveryId,
      type,
      title,
      message,
    }],
    session ? { session } : undefined
  );
};

export const getUserNotifications = async (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid user ID.");
  const user = await User.findById(userId).select("accountStatus");
  if (!user || user.accountStatus !== "active") {
    throw new Error("An active account is required to view notifications.");
  }
  return Notification.find({ recipientId: userId })
    .populate("deliveryId", "deliveryNumber status receivingStatus")
    .sort({ createdAt: -1 })
    .limit(50);
};

export const markNotificationRead = async (
  userId: string,
  notificationId: string
) => {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(notificationId)) {
    throw new Error("Invalid notification ID.");
  }
  const user = await User.findById(userId).select("accountStatus");
  if (!user || user.accountStatus !== "active") {
    throw new Error("An active account is required to update notifications.");
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipientId: userId, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (notification) return notification;

  const existing = await Notification.findOne({
    _id: notificationId,
    recipientId: userId,
  });
  if (!existing) throw new Error("Notification not found.");
  return existing;
};
