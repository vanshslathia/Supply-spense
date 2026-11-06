
import argon2 from "argon2";
import mongoose from "mongoose";

import User from "../../models/User";
import Organization from "../../models/Organizational";

import {
  CreateEmployeeInput,
  UpdateEmployeeStatusInput,
} from "./admin.validation";

export const createEmployee = async (input: CreateEmployeeInput) => {
  const normalizedEmail = input.email.toLowerCase().trim();

  // Check whether the email is already registered
  const existingUser = await User.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    throw new Error("An account with this email already exists.");
  }

  // Validate organization ID
  if (!mongoose.Types.ObjectId.isValid(input.organizationId)) {
    throw new Error("Invalid organization ID.");
  }

  // Only active organizations can receive new employees
  const organization = await Organization.findOne({
    _id: input.organizationId,
    isActive: true,
  });

  if (!organization) {
    throw new Error("Organization not found or inactive.");
  }

  // Hash password securely
  const hashedPassword = await argon2.hash(input.password);

  const employee = await User.create({
    fullName: input.fullName,
    email: normalizedEmail,
    password: hashedPassword,
    role: input.role,
    organizationId: organization._id,
    accountStatus: "active",
    emailVerified: true,
    supplierApprovalStatus: "not_submitted",
  });

  return {
    id: employee._id,
    fullName: employee.fullName,
    email: employee.email,
    role: employee.role,
    organizationId: employee.organizationId,
    accountStatus: employee.accountStatus,
    emailVerified: employee.emailVerified,
    createdAt: employee.createdAt,
  };
};

// Get employee accounts
export const getEmployees = async () => {
  const employees = await User.find({
    role: {
      $in: [
        "procurement",
        "analyst",
        "finance",
        "warehouse",
        "qc_inspector",
      ],
    },
  })
    .select(
      "-password -emailVerificationOtpHash -emailVerificationOtpExpiresAt -emailVerificationLastSentAt"
    )
    .populate("organizationId", "name organizationCode")
    .sort({ createdAt: -1 });

  return employees;
};

// Update employee account status
export const updateEmployeeStatus = async (
  userId: string,
  input: UpdateEmployeeStatusInput,
  adminId: string
) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID.");
  }

  // Prevent Admin from changing their own account status
  if (userId === adminId) {
    throw new Error("You cannot change your own account status.");
  }

  const employee = await User.findById(userId);

  if (!employee) {
    throw new Error("User not found.");
  }

  // Admin accounts cannot be modified through this endpoint
  if (employee.role === "admin") {
    throw new Error("Admin accounts cannot be modified here.");
  }

  // Only employee roles can be managed here
  const allowedRoles = [
    "procurement",
    "analyst",
    "finance",
    "warehouse",
    "qc_inspector",
  ];

  if (!allowedRoles.includes(employee.role)) {
    throw new Error("This account cannot be managed through this endpoint.");
  }

  employee.accountStatus = input.accountStatus;
  await employee.save();

  return {
    id: employee._id,
    fullName: employee.fullName,
    email: employee.email,
    role: employee.role,
    accountStatus: employee.accountStatus,
  };
};
