
import { Request, Response } from "express";

import {
  createInvoice,
  reviewInvoiceByProcurement,
  reviewInvoiceByFinance,
  getSupplierInvoices,
  getBuyerInvoices,
  getFinanceInvoices,
} from "./invoice.service";

import {
  createInvoiceSchema,
  procurementInvoiceReviewSchema,
  financeInvoiceReviewSchema,
} from "./invoice.validation";

// Supplier submits invoice.
export const createInvoiceController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "supplier") {
      return res.status(403).json({
        success: false,
        message: "Only suppliers can submit invoices.",
      });
    }

    const input = createInvoiceSchema.parse(req.body);

    const invoice = await createInvoice(
      req.session.userId,
      input
    );

    return res.status(201).json({
      success: true,
      message: "Invoice submitted successfully.",
      data: invoice,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to submit invoice.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// Procurement reviews invoice.
export const procurementReviewInvoiceController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "procurement") {
      return res.status(403).json({
        success: false,
        message: "Only procurement users can review invoices.",
      });
    }

    const invoiceId = req.params.invoiceId;

    if (typeof invoiceId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID.",
      });
    }

    const input = procurementInvoiceReviewSchema.parse(req.body);

    const invoice = await reviewInvoiceByProcurement(
      invoiceId,
      req.session.userId,
      input
    );

    return res.status(200).json({
      success: true,
      message:
        input.decision === "approve"
          ? "Invoice verified by Procurement."
          : "Invoice rejected by Procurement.",
      data: invoice,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to review invoice.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// Finance reviews invoice.
export const financeReviewInvoiceController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "finance") {
      return res.status(403).json({
        success: false,
        message: "Only finance users can review invoices.",
      });
    }

    const invoiceId = req.params.invoiceId;

    if (typeof invoiceId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID.",
      });
    }

    const input = financeInvoiceReviewSchema.parse(req.body);

    const invoice = await reviewInvoiceByFinance(
      invoiceId,
      req.session.userId,
      input
    );

    return res.status(200).json({
      success: true,
      message:
        input.decision === "approve"
          ? "Invoice approved by Finance."
          : "Invoice rejected by Finance.",
      data: invoice,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to review invoice.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// Supplier views their invoices.
export const getSupplierInvoicesController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "supplier") {
      return res.status(403).json({
        success: false,
        message: "Only suppliers can access their invoices.",
      });
    }

    const invoices = await getSupplierInvoices(req.session.userId);

    return res.status(200).json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch invoices.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// Procurement views buyer organization invoices.
export const getBuyerInvoicesController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "procurement") {
      return res.status(403).json({
        success: false,
        message: "Only procurement users can access these invoices.",
      });
    }

    const invoices = await getBuyerInvoices(req.session.userId);

    return res.status(200).json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch invoices.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// Finance views buyer organization invoices.
export const getFinanceInvoicesController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "finance") {
      return res.status(403).json({
        success: false,
        message: "Only finance users can access these invoices.",
      });
    }

    const invoices = await getFinanceInvoices(req.session.userId);

    return res.status(200).json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch invoices.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};
