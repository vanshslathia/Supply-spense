
import { Router } from "express";

import {
  register,
  verifyEmailOtp,
  resendOtp,
  login,
  getCurrentUser,
  logout,
} from "./auth.controller";

import { authenticateUser } from "../../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/verify-email", verifyEmailOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", login);


// Protected route
router.get("/me", authenticateUser, getCurrentUser);
router.post("/logout", authenticateUser, logout);

export default router;
