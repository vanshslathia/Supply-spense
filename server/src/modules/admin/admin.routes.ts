
import { Router } from "express";

import {
  createEmployeeController,
  getEmployeesController,
  updateEmployeeStatusController,
} from "./admin.controller";

import {
  authenticateUser,
  authorizeRoles,
} from "../../middleware/auth.middleware";
import organizationRoutes from "../organization/organization.routes";

const router = Router();

router.use("/organizations", organizationRoutes);

// All Admin routes require authentication and Admin authorization
router.use(authenticateUser, authorizeRoles("admin"));

// Create employee account
router.post("/users", createEmployeeController);

// Get all employee accounts
router.get("/users", getEmployeesController);

// Activate or suspend employee account
router.patch(
  "/users/:userId/status",
  updateEmployeeStatusController
);

export default router;
