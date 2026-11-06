import { Router } from "express";
import {
  getNotificationsController,
  markNotificationReadController,
} from "./notification.controller";

const router = Router();

router.get("/", getNotificationsController);
router.patch("/:notificationId/read", markNotificationReadController);

export default router;
