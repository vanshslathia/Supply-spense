
import { Request, Response, NextFunction } from "express";
import User from "../models/User";

export const requireProcurement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (
      !req.session.userId ||
      req.session.role !== "procurement"
    ) {
      res.status(403).json({
        success: false,
        message: "Only Procurement Managers can perform this action.",
      });
      return;
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Procurement user not found.",
      });
      return;
    }

    if (
      user.role !== "procurement" ||
      user.accountStatus !== "active" ||
      !user.organizationId
    ) {
      res.status(403).json({
        success: false,
        message: "Your account is not authorized for procurement access.",
      });
      return;
    }

    res.locals.procurementUser = user;

    next();
  } catch (error) {
    console.error("Procurement middleware error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to verify procurement access.",
    });
  }
};
