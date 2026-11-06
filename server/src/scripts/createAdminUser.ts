
import dotenv from "dotenv";
dotenv.config();

import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
import argon2 from "argon2";
import User from "../models/User";

async function createAdminUser() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const fullName = process.env.ADMIN_FULL_NAME?.trim();

    if (!mongoUri || !email || !password || !fullName) {
      throw new Error(
        "Missing MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD or ADMIN_FULL_NAME."
      );
    }

    if (password.length < 12) {
      throw new Error("Admin password must be at least 12 characters.");
    }

    await mongoose.connect(mongoUri);

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.role !== "admin") {
        throw new Error("Email already belongs to another user role.");
      }

      console.log("Admin account already exists.");
      return;
    }

    const hashedPassword = await argon2.hash(password);

    const admin = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role: "admin",
      accountStatus: "active",
      emailVerified: true,
      supplierApprovalStatus: "not_submitted",
    });

    console.log("Admin account created successfully!");
    console.log({
      id: admin._id,
      fullName: admin.fullName,
      email: admin.email,
      role: admin.role,
    });
  } catch (error) {
    console.error("Admin creation failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

createAdminUser();
