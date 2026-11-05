
import dotenv from "dotenv";
dotenv.config();

import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
import argon2 from "argon2";
import User from "../models/User";
import Organization from "../models/Organizational";

async function createFinanceUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);

    const email = "finance@abcmfg.com";
    const password = "FinanceTest@123";
    const organizationCode = "ABC001";

    // Find the buyer organization
    const organization = await Organization.findOne({
      organizationCode,
      isActive: true,
    });

    if (!organization) {
      throw new Error("Active organization not found.");
    }

    // Check whether the account already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.role !== "finance") {
        throw new Error("Email already belongs to another user role.");
      }

      console.log("Finance Manager account already exists.");
      return;
    }

    // Hash password
    const hashedPassword = await argon2.hash(password);

    // Create Finance Manager
    const financeUser = await User.create({
      fullName: "ABC Finance Manager",
      email,
      password: hashedPassword,
      role: "finance",
      organizationId: organization._id,
      accountStatus: "active",
      emailVerified: true,
      supplierApprovalStatus: "not_submitted",
    });

    console.log("Finance Manager created successfully!");
    console.log({
      id: financeUser._id,
      email: financeUser.email,
      role: financeUser.role,
      organizationId: financeUser.organizationId,
    });

  } catch (error) {
    console.error("Finance Manager creation failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

createFinanceUser();
