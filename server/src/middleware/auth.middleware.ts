
import { Request, Response, NextFunction } from "express";
import User from "../models/User";

export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({
        success: false,
        message: "User account not found. Please log in again.",
      });
      return;
    }

    if (user.accountStatus !== "active") {
      req.session.destroy(() => {});
      res.status(403).json({
        success: false,
        message: "Your account is not active.",
      });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({
        success: false,
        message: "Please verify your email first.",
      });
      return;
    }

    res.locals.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

// Role-based authorization
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = res.locals.user;

    if (!user || !allowedRoles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource.",
      });
      return;
    }

    next();
  };
};
