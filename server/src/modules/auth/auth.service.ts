
import argon2 from "argon2";
import User from "../../models/User";
import Organization from "../../models/Organizational";
import {
  RegisterInput,
  LoginInput,
  ResendOtpInput,
} from "./auth.validation";
import { generateAndSendOtp } from "./otp.service";

// SUPPLIER REGISTRATION
export const registerUser = async (input: RegisterInput) => {
  const { fullName, email, password, role } = input;

  // Only suppliers can register publicly
  if (role !== "supplier") {
    throw new Error("Public registration is only available for suppliers.");
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new Error("An account with this email already exists.");
  }

  const hashedPassword = await argon2.hash(password);

  const user = await User.create({
    fullName,
    email,
    password: hashedPassword,
    role: "supplier",
    accountStatus: "active",
    supplierApprovalStatus: "pending",
    emailVerified: false,
  });

  await generateAndSendOtp(user.id.toString());

  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    supplierApprovalStatus: user.supplierApprovalStatus,
    emailVerified: user.emailVerified,
  };
};

// VERIFY EMAIL
export const verifyEmail = async (email: string, otp: string) => {
  const user = await User.findOne({ email }).select(
    "+emailVerificationOtpHash +emailVerificationOtpExpiresAt"
  );

  if (!user) {
    throw new Error("Invalid email or OTP.");
  }

  if (user.emailVerified) {
    throw new Error("Email is already verified.");
  }

  if (
    !user.emailVerificationOtpHash ||
    !user.emailVerificationOtpExpiresAt
  ) {
    throw new Error("No active OTP found. Please request a new one.");
  }

  if (user.emailVerificationOtpExpiresAt.getTime() < Date.now()) {
    throw new Error("OTP has expired. Please request a new one.");
  }

  const isValidOtp = await argon2.verify(
    user.emailVerificationOtpHash,
    otp
  );

  if (!isValidOtp) {
    throw new Error("Invalid email or OTP.");
  }

  user.emailVerified = true;
  user.emailVerificationOtpHash = undefined;
  user.emailVerificationOtpExpiresAt = undefined;
  user.emailVerificationLastSentAt = undefined;

  await user.save();

  return {
    email: user.email,
    emailVerified: user.emailVerified,
    accountStatus: user.accountStatus,
    supplierApprovalStatus: user.supplierApprovalStatus,
  };
};

// RESEND EMAIL VERIFICATION OTP
export const resendVerificationOtp = async (input: ResendOtpInput) => {
  const { email } = input;

  const user = await User.findOne({ email });

  // Generic response prevents account enumeration
  if (!user || user.role !== "supplier" || user.emailVerified) {
    return {
      message: "If an eligible account exists, a verification email will be sent.",
    };
  }

  return generateAndSendOtp(user.id.toString());
};

// LOGIN
export const loginUser = async (input: LoginInput) => {
  const { email, password } = input;

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const isPasswordValid = await argon2.verify(user.password, password);

  if (!isPasswordValid) {
    throw new Error("Invalid email or password.");
  }

  // Email verification is required for every role
  if (!user.emailVerified) {
    throw new Error("Please verify your email before logging in.");
  }

  // Account access check
  if (user.accountStatus === "suspended") {
    throw new Error("Your account has been suspended.");
  }

  if (user.role !== "admin" && user.organizationId) {
    const organization = await Organization.findById(
      user.organizationId
    ).select("isActive");

    if (!organization?.isActive) {
      throw new Error("Your organization is inactive.");
    }
  }

  // Supplier business approval is separate from login authentication
  if (
    user.role === "supplier" &&
    user.supplierApprovalStatus !== "approved"
  ) {
    throw new Error(
      "Your email is verified, but your supplier profile is awaiting business approval."
    );
  }

  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    accountStatus: user.accountStatus,
    supplierApprovalStatus: user.supplierApprovalStatus,
    emailVerified: user.emailVerified,
  };
};
