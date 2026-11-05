
import { Request, Response } from "express";

import {
  registerUser,
  verifyEmail,
  resendVerificationOtp,
  loginUser,
} from "./auth.service";

import {
  registerSchema,
  verifyEmailSchema,
  resendOtpSchema,
  loginSchema,
} from "./auth.validation";

// ==========================================
// SUPPLIER REGISTRATION
// ==========================================

export const register = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const validation = registerSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const user = await registerUser(validation.data);

    res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your email.",
      data: user,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration failed.";

    const statusCode =
      message === "Public registration is only available for suppliers."
        ? 403
        : message === "An account with this email already exists."
          ? 409
          : 500;

    res.status(statusCode).json({
      success: false,
      message:
        statusCode === 500
          ? "Something went wrong. Please try again."
          : message,
    });
  }
};

// ==========================================
// EMAIL OTP VERIFICATION
// ==========================================

export const verifyEmailOtp = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const validation = verifyEmailSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const { email, otp } = validation.data;
    const result = await verifyEmail(email, otp);

    res.status(200).json({
      success: true,
      message: "Email verified successfully.",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Email verification failed.";

    const statusCode =
      message === "Email is already verified." ? 409 : 400;

    res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

// ==========================================
// RESEND EMAIL VERIFICATION OTP
// ==========================================

export const resendOtp = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const validation = resendOtpSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid email address.",
      });
      return;
    }

    const result = await resendVerificationOtp(validation.data);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to resend OTP.";

    if (message === "Please wait before requesting another OTP.") {
      res.status(429).json({
        success: false,
        message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Unable to process your request. Please try again later.",
    });
  }
};

// ==========================================
// USER LOGIN
// ==========================================

export const login = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const user = await loginUser(validation.data);

    // Regenerate session to prevent session fixation
    req.session.regenerate((error) => {
      if (error) {
        res.status(500).json({
          success: false,
          message: "Unable to create login session.",
        });
        return;
      }

      req.session.userId = user.id.toString();
      req.session.role = user.role;

      req.session.save((saveError) => {
        if (saveError) {
          res.status(500).json({
            success: false,
            message: "Unable to save login session.",
          });
          return;
        }

        res.status(200).json({
          success: true,
          message: "Login successful.",
          data: {
            user,
          },
        });
      });
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Login failed.";

    const statusCode =
      message === "Invalid email or password."
        ? 401
        : message === "Please verify your email before logging in."
          ? 403
          : message === "Your account has been suspended."
            ? 403
            : message ===
                "Your email is verified, but your supplier profile is awaiting business approval."
              ? 403
              : 500;

    res.status(statusCode).json({
      success: false,
      message:
        statusCode === 500
          ? "Something went wrong. Please try again."
          : message,
    });
  }
};


export const getCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = res.locals.user;

  res.status(200).json({
    success: true,
    message: "Current user fetched successfully.",
    data: {
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        companyName: user.companyName,
        accountStatus: user.accountStatus,
        supplierApprovalStatus: user.supplierApprovalStatus,
        emailVerified: user.emailVerified,
      },
    },
  });
};


export const logout = async (
  req: Request,
  res: Response
): Promise<void> => {
  req.session.destroy((error) => {
    if (error) {
      res.status(500).json({
        success: false,
        message: "Unable to log out. Please try again.",
      });
      return;
    }

    res.clearCookie("supplysense.sid");

    res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  });
};
