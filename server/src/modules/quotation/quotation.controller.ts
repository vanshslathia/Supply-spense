
import { Request, Response } from "express";
import { createQuotationSchema } from "./quotation.validation";

import {
  createQuotation,
  getQuotationsByRFQ,
  compareQuotationsByRFQ,
  reviewQuotation,
} from "./quotation.service";

// ==========================================
// 1. SUPPLIER SUBMITS QUOTATION
// ==========================================

export const createQuotationController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.session.userId || req.session.role !== "supplier") {
      res.status(401).json({
        success: false,
        message: "Supplier authentication required.",
      });
      return;
    }

    const validation = createQuotationSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid quotation data.",
        errors: validation.error.flatten(),
      });
      return;
    }

    const quotation = await createQuotation(
      validation.data,
      req.session.userId
    );

    res.status(201).json({
      success: true,
      message: "Quotation submitted successfully.",
      data: { quotation },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to submit quotation.";

    if (message.includes("already created")) {
      res.status(409).json({ success: false, message });
      return;
    }

    if (
      message.includes("Invalid") ||
      message.includes("not found") ||
      message.includes("Duplicate") ||
      message.includes("every RFQ item") ||
      message.includes("do not belong")
    ) {
      res.status(400).json({ success: false, message });
      return;
    }

    console.error("Create quotation error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to submit quotation.",
    });
  }
};

// ==========================================
// 2. PROCUREMENT VIEWS RFQ QUOTATIONS
// ==========================================

export const getQuotationsByRFQController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.session.userId || req.session.role !== "procurement") {
      res.status(401).json({
        success: false,
        message: "Procurement authentication required.",
      });
      return;
    }

    const rfqId = req.params.rfqId;

    if (typeof rfqId !== "string" || !rfqId.trim()) {
      res.status(400).json({
        success: false,
        message: "A valid RFQ ID is required.",
      });
      return;
    }

    const quotations = await getQuotationsByRFQ(
      rfqId,
      req.session.userId
    );

    res.status(200).json({
      success: true,
      count: quotations.length,
      data: { quotations },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to retrieve quotations.";

    if (message.includes("not authorized")) {
      res.status(403).json({ success: false, message });
      return;
    }

    if (message.includes("account required")) {
      res.status(403).json({ success: false, message });
      return;
    }

    if (
      message.includes("Invalid") ||
      message.includes("not found") ||
      message.includes("required")
    ) {
      res.status(400).json({ success: false, message });
      return;
    }

    console.error("Get quotations error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve quotations.",
    });
  }
};

// ==========================================
// 3. PROCUREMENT COMPARES QUOTATIONS
// ==========================================

export const compareQuotationsByRFQController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.session.userId || req.session.role !== "procurement") {
      res.status(401).json({
        success: false,
        message: "Procurement authentication required.",
      });
      return;
    }

    const rfqId = req.params.rfqId;

    if (typeof rfqId !== "string" || !rfqId.trim()) {
      res.status(400).json({
        success: false,
        message: "A valid RFQ ID is required.",
      });
      return;
    }

    const comparison = await compareQuotationsByRFQ(
      rfqId,
      req.session.userId
    );

    res.status(200).json({
      success: true,
      message: "Quotation comparison generated successfully.",
      data: comparison,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to compare quotations.";

    if (message.includes("not authorized")) {
      res.status(403).json({ success: false, message });
      return;
    }

    if (message.includes("account required")) {
      res.status(403).json({ success: false, message });
      return;
    }

    if (
      message.includes("Invalid") ||
      message.includes("not found")
    ) {
      res.status(400).json({ success: false, message });
      return;
    }

    console.error("Compare quotations error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to compare quotations.",
    });
  }
};

// ==========================================
// 4. PROCUREMENT ACCEPTS OR REJECTS QUOTATION
// ==========================================

export const reviewQuotationController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.session.userId || req.session.role !== "procurement") {
      res.status(401).json({
        success: false,
        message: "Procurement authentication required.",
      });
      return;
    }

    const quotationId = req.params.quotationId;
    const { decision, rejectionReason } = req.body;

    if (
      typeof quotationId !== "string" ||
      !quotationId.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "A valid quotation ID is required.",
      });
      return;
    }

    if (decision !== "accepted" && decision !== "rejected") {
      res.status(400).json({
        success: false,
        message: "Decision must be accepted or rejected.",
      });
      return;
    }

    if (
      decision === "rejected" &&
      (
        typeof rejectionReason !== "string" ||
        !rejectionReason.trim()
      )
    ) {
      res.status(400).json({
        success: false,
        message: "A rejection reason is required.",
      });
      return;
    }

    const result = await reviewQuotation(
      quotationId,
      req.session.userId,
      decision,
      rejectionReason
    );

    res.status(200).json({
      success: true,
      message:
        decision === "accepted"
          ? "Quotation accepted successfully."
          : "Quotation rejected successfully.",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to review quotation.";

    if (
      message.includes("not authorized") ||
      message.includes("account required")
    ) {
      res.status(403).json({ success: false, message });
      return;
    }

    if (message.includes("already been accepted")) {
      res.status(409).json({ success: false, message });
      return;
    }

    if (
      message.includes("Invalid") ||
      message.includes("not found") ||
      message.includes("required") ||
      message.includes("expired") ||
      message.includes("cannot be reviewed") ||
      message.includes("not eligible") ||
      message.includes("inconsistent") ||
      message.includes("relationships") ||
      message.includes("Supplier account") ||
      message.includes("commercial totals") ||
      message.includes("delivery details") ||
      message.includes("totals do not match") ||
      message.includes("supported range") ||
      message.includes("quantity is invalid")
    ) {
      res.status(400).json({ success: false, message });
      return;
    }

    console.error("Review quotation error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to review quotation.",
    });
  }
};
