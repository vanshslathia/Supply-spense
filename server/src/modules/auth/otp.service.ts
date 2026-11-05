
import crypto from "node:crypto";
import argon2 from "argon2";
import nodemailer from "nodemailer";

import User from "../../models/User";
import emailTransporter from "../../config/email";

const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

export const generateAndSendOtp = async (userId: string) => {
  const user = await User.findById(userId).select(
    "+emailVerificationLastSentAt"
  );

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.emailVerified) {
    throw new Error("Email is already verified.");
  }

  // Prevent repeated OTP requests within 60 seconds.
  if (user.emailVerificationLastSentAt) {
    const elapsedSeconds =
      (Date.now() - user.emailVerificationLastSentAt.getTime()) / 1000;

    if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
      throw new Error("Please wait before requesting another OTP.");
    }
  }

  // Generate a cryptographically secure six-digit OTP.
  const otp = crypto.randomInt(100000, 1000000).toString();

  // Hash OTP before storing it in MongoDB.
  const otpHash = await argon2.hash(otp);

  const expiresAt = new Date(
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
  );

  user.emailVerificationOtpHash = otpHash;
  user.emailVerificationOtpExpiresAt = expiresAt;
  user.emailVerificationLastSentAt = new Date();

  await user.save();

  try {
    // Send verification email.
    const emailInfo = await emailTransporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: "Verify your SupplySense AI account",

      text: `Your SupplySense AI verification code is ${otp}. It expires in 10 minutes.`,

      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px;">
          <h2>Welcome to SupplySense AI</h2>

          <p>
            Use the verification code below to verify your email address.
          </p>

          <h1 style="letter-spacing: 8px; text-align: center;">
            ${otp}
          </h1>

          <p>This code expires in 10 minutes.</p>

          <p>
            If you did not request this, please ignore this email.
          </p>

          <p>Regards,<br />SupplySense AI Team</p>
        </div>
      `,
    });

    // Show Ethereal preview URL during development.
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "OTP Email Preview:",
        nodemailer.getTestMessageUrl(emailInfo)
      );
    }
  } catch (error) {
    // Clear OTP details if email sending fails.
    user.emailVerificationOtpHash = undefined;
    user.emailVerificationOtpExpiresAt = undefined;
    user.emailVerificationLastSentAt = undefined;

    await user.save();

    console.error("OTP email sending failed:", error);

    throw new Error("Unable to send verification email.");
  }

  return {
    message: "Verification OTP sent successfully.",
    expiresInMinutes: OTP_EXPIRY_MINUTES,
  };
};
