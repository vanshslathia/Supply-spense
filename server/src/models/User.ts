
import mongoose, { Schema, Document, Types } from "mongoose";

export type UserRole =
  | "admin"
  | "procurement"
  | "supplier"
  | "analyst"
  | "finance"
  | "warehouse"
  | "qc_inspector";

// Account login/access status
export type AccountStatus = "active" | "suspended";

// Supplier business verification status
export type SupplierApprovalStatus =
  | "not_submitted"
  | "pending"
  | "approved"
  | "rejected";

export interface IUser extends Document {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  organizationId?: Types.ObjectId;
  companyName?: string;

  accountStatus: AccountStatus;
  supplierApprovalStatus?: SupplierApprovalStatus;

  emailVerified: boolean;

  // Email verification OTP fields
  emailVerificationOtpHash?: string;
  emailVerificationOtpExpiresAt?: Date;
  emailVerificationLastSentAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: [
        "admin",
        "procurement",
        "supplier",
        "analyst",
        "finance",
        "warehouse",
        "qc_inspector",
      ],
      required: true,
    },

    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
    },

    companyName: {
      type: String,
      trim: true,
    },

    // Controls whether the user account can be accessed
    accountStatus: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },

    // Controls supplier business onboarding separately
    supplierApprovalStatus: {
      type: String,
      enum: ["not_submitted", "pending", "approved", "rejected"],
      default: "not_submitted",
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    // Store only the hashed OTP, never the plain OTP
    emailVerificationOtpHash: {
      type: String,
      select: false,
    },

    emailVerificationOtpExpiresAt: {
      type: Date,
      select: false,
    },

    emailVerificationLastSentAt: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
