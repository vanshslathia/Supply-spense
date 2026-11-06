
import { Request, Response, NextFunction } from "express";
import User from "../models/User";
import Organization from "../models/Organizational";

export const enforceActiveOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      next();
      return;
    }

    const user = await User.findById(userId).select("role organizationId");
    if (!user || user.role === "admin" || !user.organizationId) {
      next();
      return;
    }

    const organization = await Organization.findById(
      user.organizationId
    ).select("isActive");

    if (organization?.isActive) {
      next();
      return;
    }

    req.session.destroy((error) => {
      if (error) {
        next(error);
        return;
      }
      res.clearCookie("supplysense.sid");
      res.status(403).json({
        success: false,
        message: "Your organization is inactive. Access has been revoked.",
      });
    });
  } catch (error) {
    next(error);
  }
};

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
