
import { Request, Response, NextFunction } from "express";

import {
  createEmployee,
  getEmployees,
  updateEmployeeStatus,
} from "./admin.service";

import {
  createEmployeeSchema,
  updateEmployeeStatusSchema,
} from "./admin.validation";

// Create employee
export const createEmployeeController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validation = createEmployeeSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const employee = await createEmployee(validation.data);

    res.status(201).json({
      success: true,
      message: "Employee account created successfully.",
      data: employee,
    });
  } catch (error) {
    next(error);
  }
};

// Get all employee accounts
export const getEmployeesController = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const employees = await getEmployees();

    res.status(200).json({
      success: true,
      message: "Employees fetched successfully.",
      data: employees,
    });
  } catch (error) {
    next(error);
  }
};

// Update employee account status
export const updateEmployeeStatusController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validation = updateEmployeeStatusSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const admin = res.locals.user;
    const userId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId;

    const employee = await updateEmployeeStatus(
      userId,
      validation.data,
      admin._id.toString()
    );

    res.status(200).json({
      success: true,
      message: "Employee account status updated successfully.",
      data: employee,
    });
  } catch (error) {
    next(error);
  }
};
