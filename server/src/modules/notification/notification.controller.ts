import { Request, Response } from "express";
import {
  getUserNotifications,
  markNotificationRead,
} from "./notification.service";

export const getNotificationsController = async (
  req: Request,
  res: Response
) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  try {
    const notifications = await getUserNotifications(req.session.userId);
    return res.status(200).json({
      success: true,
      data: { notifications },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load notifications.";
    return res.status(400).json({ success: false, message });
  }
};

export const markNotificationReadController = async (
  req: Request,
  res: Response
) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  try {
    const notification = await markNotificationRead(
      req.session.userId,
      req.params.notificationId as string
    );
    return res.status(200).json({
      success: true,
      data: { notification },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update notification.";
    return res.status(400).json({ success: false, message });
  }
};
