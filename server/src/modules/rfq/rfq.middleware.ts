
import { Request, Response, NextFunction } from "express";
import User from "../../models/User";

export const requireProcurement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check session
    if (!req.session.userId || req.session.role !== "procurement") {
      res.status(403).json({
        success: false,
        message: "Only Procurement Managers can perform this action.",
      });
      return;
    }

    // Fetch user
    const user = await User.findById(req.session.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User account not found.",
      });
      return;
    }

    // Check account status
    if (user.accountStatus !== "active") {
      res.status(403).json({
        success: false,
        message: "Your account is not active.",
      });
      return;
    }

    // Check organization association
    if (!user.organizationId) {
      res.status(403).json({
        success: false,
        message: "Your account is not associated with an organization.",
      });
      return;
    }

    // Attach authenticated user to request
    res.locals.procurementUser = user;

    next();
  } catch (error) {
    console.error("Procurement authorization error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to verify Procurement access.",
    });
  }
};
