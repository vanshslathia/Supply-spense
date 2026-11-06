
import mongoose from "mongoose";
import Organization from "../../models/Organizational";
import RFQ from "../../models/RFQ";
import { CreateRFQInput } from "./rfq.validation";

// ==========================================
// GENERATE UNIQUE RFQ NUMBER
// ==========================================

const generateRFQNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 5; attempt++) {
    const randomNumber = Math.floor(
      100000 + Math.random() * 900000
    );

    const rfqNumber = `RFQ-${year}-${randomNumber}`;

    const existingRFQ = await RFQ.exists({ rfqNumber });

    if (!existingRFQ) {
      return rfqNumber;
    }
  }

  throw new Error("Unable to generate a unique RFQ number.");
};

// ==========================================
// CREATE RFQ
// ==========================================

export const createRFQ = async (
  input: CreateRFQInput,
  buyerOrganizationId: string,
  createdBy: string
) => {
  if (!mongoose.isValidObjectId(buyerOrganizationId)) {
    throw new Error("Invalid buyer organization.");
  }

  if (!mongoose.isValidObjectId(createdBy)) {
    throw new Error("Invalid user.");
  }

  if (input.visibility === "invited") {
    const supplierIds = input.invitedSuppliers ?? [];
    const uniqueSupplierIds = [...new Set(supplierIds)];

    if (uniqueSupplierIds.length !== supplierIds.length) {
      throw new Error("Duplicate supplier invitations are not allowed.");
    }
  }

  const rfqNumber = await generateRFQNumber();

  const rfq = await RFQ.create({
    rfqNumber,
    title: input.title,
    description: input.description,
    category: input.category,
    items: input.items,
    buyerOrganizationId,
    createdBy,
    visibility: input.visibility,
    invitedSuppliers:
      input.visibility === "invited"
        ? input.invitedSuppliers ?? []
        : [],
    deliveryLocation: input.deliveryLocation,
    deliveryDate: input.deliveryDate,
    submissionDeadline: input.submissionDeadline,
    status: "draft",
  });

  return rfq;
};

// ==========================================
// GET ALL RFQS — PROCUREMENT MANAGER
// ==========================================

export const getProcurementRFQs = async (
  organizationId: string
) => {
  if (!mongoose.isValidObjectId(organizationId)) {
    throw new Error("Invalid organization.");
  }

  return await RFQ.find({
    buyerOrganizationId: new mongoose.Types.ObjectId(organizationId),
  })
    .sort({ createdAt: -1 })
    .lean();
};

// ==========================================
// GET SINGLE RFQ — PROCUREMENT MANAGER
// ==========================================

export const getProcurementRFQById = async (
  rfqId: string,
  organizationId: string
) => {
  if (
    !mongoose.isValidObjectId(rfqId) ||
    !mongoose.isValidObjectId(organizationId)
  ) {
    throw new Error("Invalid RFQ or organization.");
  }

  const rfq = await RFQ.findOne({
    _id: new mongoose.Types.ObjectId(rfqId),
    buyerOrganizationId: new mongoose.Types.ObjectId(organizationId),
  }).lean();

  if (!rfq) {
    throw new Error("RFQ not found.");
  }

  return rfq;
};

// ==========================================
// GET AVAILABLE RFQS — SUPPLIER
// ==========================================

export const getSupplierRFQs = async (supplierId: string) => {
  if (!mongoose.isValidObjectId(supplierId)) {
    throw new Error("Invalid supplier.");
  }

  const now = new Date();

  return await RFQ.find({
    status: "published",
    submissionDeadline: { $gt: now },
    $or: [
      { visibility: "open" },
      {
        visibility: "invited",
        invitedSuppliers: new mongoose.Types.ObjectId(supplierId),
      },
    ],
  })
    .populate({
      path: "buyerOrganizationId",
      select: "name",
      model: Organization,
    })
    .sort({ submissionDeadline: 1 })
    .lean();
};

// ==========================================
// GET SINGLE RFQ — SUPPLIER
// ==========================================

export const getSupplierRFQById = async (
  rfqId: string,
  supplierId: string
) => {
  if (
    !mongoose.isValidObjectId(rfqId) ||
    !mongoose.isValidObjectId(supplierId)
  ) {
    throw new Error("Invalid RFQ or supplier.");
  }

  const now = new Date();

  const rfq = await RFQ.findOne({
    _id: rfqId,
    status: "published",
    submissionDeadline: { $gt: now },
    $or: [
      { visibility: "open" },
      {
        visibility: "invited",
        invitedSuppliers: new mongoose.Types.ObjectId(supplierId),
      },
    ],
  })
    .populate({
      path: "buyerOrganizationId",
      select: "name",
      model: Organization,
    })
    .lean();

  if (!rfq) {
    throw new Error("RFQ not found or unavailable.");
  }

  return rfq;
};
