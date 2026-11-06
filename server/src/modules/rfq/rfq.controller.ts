
import mongoose from "mongoose";
import { Request, Response } from "express";
import RFQ from "../../models/RFQ";
import User from "../../models/User";

import {
  createRFQ,
  getProcurementRFQs,
  getProcurementRFQById,
  getSupplierRFQs,
  getSupplierRFQById,
} from "./rfq.service";

import { createRFQSchema } from "./rfq.validation";

// ==========================================
// CREATE RFQ — PROCUREMENT MANAGER
// ==========================================

export const createRFQController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.session.userId || req.session.role !== "procurement") {
      res.status(403).json({
        success: false,
        message: "Only Procurement Managers can create RFQs.",
      });
      return;
    }

    const validation = createRFQSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "RFQ validation failed.",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "Procurement user not found.",
      });
      return;
    }

    if (
      user.accountStatus !== "active" ||
      !user.organizationId
    ) {
      res.status(403).json({
        success: false,
        message:
          "Your account is not associated with an active organization.",
      });
      return;
    }

    const rfq = await createRFQ(
      validation.data,
      user.organizationId.toString(),
      user.id.toString()
    );

    res.status(201).json({
      success: true,
      message: "RFQ created successfully as a draft.",
      data: { rfq },
    });
  } catch (error) {
    console.error("Create RFQ error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create RFQ.",
    });
  }
};

// ==========================================
// GET ALL RFQS — PROCUREMENT MANAGER
// ==========================================

export const getProcurementRFQsController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const procurementUser = res.locals.procurementUser;

    if (!procurementUser) {
      res.status(401).json({
        success: false,
        message: "Procurement authentication required.",
      });
      return;
    }

    const rfqs = await getProcurementRFQs(
      procurementUser.organizationId.toString()
    );

    res.status(200).json({
      success: true,
      count: rfqs.length,
      data: { rfqs },
    });
  } catch (error) {
    console.error("Get procurement RFQs error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve procurement RFQs.",
    });
  }
};

// ==========================================
// GET SINGLE RFQ — PROCUREMENT MANAGER
// ==========================================

export const getProcurementRFQByIdController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const procurementUser = res.locals.procurementUser;

    if (!procurementUser) {
      res.status(401).json({
        success: false,
        message: "Procurement authentication required.",
      });
      return;
    }

    const rfqId = req.params.id;

    if (
      typeof rfqId !== "string" ||
      !mongoose.Types.ObjectId.isValid(rfqId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid RFQ identifier.",
      });
      return;
    }

    const rfq = await getProcurementRFQById(
      rfqId,
      procurementUser.organizationId.toString()
    );

    res.status(200).json({
      success: true,
      data: { rfq },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to retrieve RFQ.";

    if (
      message === "RFQ not found." ||
      message === "Invalid RFQ or organization."
    ) {
      res.status(
        message === "RFQ not found." ? 404 : 400
      ).json({
        success: false,
        message,
      });
      return;
    }

    console.error("Get procurement RFQ details error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve RFQ details.",
    });
  }
};

// ==========================================
// GET AVAILABLE RFQS — SUPPLIER
// ==========================================

export const getSupplierRFQsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.session.userId || req.session.role !== "supplier") {
      res.status(403).json({
        success: false,
        message: "Only suppliers can access available RFQs.",
      });
      return;
    }

    const supplier = await User.findById(req.session.userId);

    if (
      !supplier ||
      !supplier.emailVerified ||
      supplier.accountStatus !== "active" ||
      supplier.supplierApprovalStatus !== "approved"
    ) {
      res.status(403).json({
        success: false,
        message: "Your supplier account is not approved.",
      });
      return;
    }

    const rfqs = await getSupplierRFQs(supplier.id.toString());

    res.status(200).json({
      success: true,
      count: rfqs.length,
      data: { rfqs },
    });
  } catch (error) {
    console.error("Get supplier RFQs error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve RFQs.",
    });
  }
};

// ==========================================
// GET SINGLE RFQ — SUPPLIER
// ==========================================

export const getSupplierRFQByIdController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.session.userId || req.session.role !== "supplier") {
      res.status(403).json({
        success: false,
        message: "Only suppliers can access RFQ details.",
      });
      return;
    }

    const rfqId = req.params.id;

    if (typeof rfqId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid RFQ identifier.",
      });
      return;
    }

    const supplier = await User.findById(req.session.userId);

    if (
      !supplier ||
      !supplier.emailVerified ||
      supplier.accountStatus !== "active" ||
      supplier.supplierApprovalStatus !== "approved"
    ) {
      res.status(403).json({
        success: false,
        message: "Your supplier account is not approved.",
      });
      return;
    }

    const rfq = await getSupplierRFQById(
      rfqId,
      supplier.id.toString()
    );

    res.status(200).json({
      success: true,
      data: { rfq },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to retrieve RFQ.";

    if (
      message === "RFQ not found or unavailable." ||
      message === "Invalid RFQ or supplier."
    ) {
      res.status(
        message === "RFQ not found or unavailable." ? 404 : 400
      ).json({
        success: false,
        message,
      });
      return;
    }

    console.error("Get RFQ details error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve RFQ details.",
    });
  }
};

// ==========================================
// PUBLISH RFQ — PROCUREMENT MANAGER
// ==========================================

export const publishRFQController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const procurementUser = res.locals.procurementUser;

    if (!procurementUser) {
      res.status(401).json({
        success: false,
        message: "Procurement authentication required.",
      });
      return;
    }

    const rfqId = req.params.id;

    if (
      typeof rfqId !== "string" ||
      !mongoose.Types.ObjectId.isValid(rfqId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid RFQ identifier.",
      });
      return;
    }

    const rfq = await RFQ.findById(rfqId);

    if (!rfq) {
      res.status(404).json({
        success: false,
        message: "RFQ not found.",
      });
      return;
    }

    if (
      rfq.buyerOrganizationId.toString() !==
      procurementUser.organizationId.toString()
    ) {
      res.status(403).json({
        success: false,
        message:
          "You cannot publish an RFQ belonging to another organization.",
      });
      return;
    }

    if (rfq.status !== "draft") {
      res.status(400).json({
        success: false,
        message: "Only draft RFQs can be published.",
      });
      return;
    }

    if (rfq.submissionDeadline <= new Date()) {
      res.status(400).json({
        success: false,
        message:
          "Cannot publish an RFQ with an expired submission deadline.",
      });
      return;
    }

    rfq.status = "published";
    await rfq.save();

    res.status(200).json({
      success: true,
      message: "RFQ published successfully.",
      data: { rfq },
    });
  } catch (error) {
    console.error("Publish RFQ error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to publish RFQ.",
    });
  }
};
