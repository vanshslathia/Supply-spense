
import mongoose, { Schema, Document, Types } from "mongoose";

export type QuotationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "accepted"
  | "rejected"
  | "withdrawn";

export interface IQuotationItem {
  rfqItemId: Types.ObjectId;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  remarks?: string;
}

export interface IQuotation extends Document {
  quotationNumber: string;
  rfqId: Types.ObjectId;
  supplierId: Types.ObjectId;
  buyerOrganizationId: Types.ObjectId;

  items: IQuotationItem[];

  subtotal: number;
  taxPercentage: number;
  taxAmount: number;
  deliveryCharges: number;
  totalAmount: number;

  deliveryTimeline: number;
  validityDate: Date;
  supplierRemarks?: string;

  status: QuotationStatus;
  submittedAt?: Date;

  // Procurement review details
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const quotationItemSchema = new Schema<IQuotationItem>(
  {
    rfqItemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { _id: false }
);

const quotationSchema = new Schema<IQuotation>(
  {
    quotationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    rfqId: {
      type: Schema.Types.ObjectId,
      ref: "RFQ",
      required: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    buyerOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    items: {
      type: [quotationItemSchema],
      required: true,
      validate: {
        validator: (items: IQuotationItem[]) => items.length > 0,
        message: "A quotation must contain at least one item.",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    taxAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    deliveryCharges: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    deliveryTimeline: {
      type: Number,
      required: true,
      min: 1,
    },
    validityDate: {
      type: Date,
      required: true,
    },
    supplierRemarks: {
      type: String,
      trim: true,
      maxlength: 3000,
    },
    status: {
      type: String,
      enum: [
        "draft",
        "submitted",
        "under_review",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      default: "draft",
      index: true,
    },
    submittedAt: {
      type: Date,
    },

    // Procurement review details
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

// A supplier can submit only one quotation per RFQ.
quotationSchema.index(
  { rfqId: 1, supplierId: 1 },
  { unique: true }
);

// Only one quotation can be accepted for an RFQ.
quotationSchema.index(
  { rfqId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "accepted",
    },
  }
);

quotationSchema.index({ buyerOrganizationId: 1, status: 1 });
quotationSchema.index({ supplierId: 1, createdAt: -1 });

const Quotation = mongoose.model<IQuotation>(
  "Quotation",
  quotationSchema
);

export default Quotation;
