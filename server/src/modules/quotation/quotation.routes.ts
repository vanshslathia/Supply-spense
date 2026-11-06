
import { Router } from "express";

import {
  createQuotationController,
  getQuotationsByRFQController,
  compareQuotationsByRFQController,
  reviewQuotationController,
} from "./quotation.controller";

const router = Router();

// Supplier submits quotation
router.post("/", createQuotationController);

// Procurement views quotations for an RFQ
router.get("/rfq/:rfqId", getQuotationsByRFQController);

// Procurement compares quotations
router.get("/rfq/:rfqId/compare", compareQuotationsByRFQController);

// Procurement accepts or rejects a quotation
router.patch("/:quotationId/review", reviewQuotationController);

export default router;
