import dotenv from "dotenv";
dotenv.config();

import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
import User from "../models/User";

async function fixAdminEmail() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);

    const oldEmail = "test_admin@123";
    const newEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      throw new Error("Please provide a valid ADMIN_EMAIL.");
    }

    const existing = await User.findOne({ email: newEmail });

    if (existing) {
      throw new Error("The new email is already registered.");
    }

    const admin = await User.findOneAndUpdate(
      { email: oldEmail, role: "admin" },
      { $set: { email: newEmail } },
      { new: true }
    );

    if (!admin) {
      throw new Error("Existing Admin account not found.");
    }

    console.log("Admin email updated successfully!");
    console.log({
      email: admin.email,
      role: admin.role,
    });
  } catch (error) {
    console.error("Email update failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

fixAdminEmail();