
import mongoose, { Schema, Document, Types } from "mongoose";

export type InvoiceStatus =
  | "submitted"
  | "procurement_verified"
  | "procurement_rejected"
  | "finance_approved"
  | "finance_rejected";

export type InvoicePaymentStatus =
  | "pending"
  | "partially_paid"
  | "paid";

export interface IInvoiceItem {
  poItemId: Types.ObjectId;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  purchaseOrderId: Types.ObjectId;
  supplierId: Types.ObjectId;
  buyerOrganizationId: Types.ObjectId;

  items: IInvoiceItem[];

  invoiceDate: Date;
  dueDate: Date;

  subtotal: number;
  taxPercentage: number;
  taxAmount: number;
  additionalCharges: number;
  totalAmount: number;

  documentUrl?: string;
  notes?: string;

  status: InvoiceStatus;
  paymentStatus: InvoicePaymentStatus;
  amountPaid: number;

  procurementReviewedBy?: Types.ObjectId;
  procurementReviewedAt?: Date;
  procurementRemarks?: string;

  financeApprovedBy?: Types.ObjectId;
  financeApprovedAt?: Date;
  financeRemarks?: string;

  createdAt: Date;
  updatedAt: Date;
}

const invoiceItemSchema = new Schema<IInvoiceItem>(
  {
    poItemId: {
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
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },

    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
      index: true,
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
      index: true,
    },

    items: {
      type: [invoiceItemSchema],
      required: true,
      validate: {
        validator: (items: IInvoiceItem[]) =>
          items.length > 0,
        message: "At least one invoice item is required.",
      },
    },

    invoiceDate: {
      type: Date,
      required: true,
    },

    dueDate: {
      type: Date,
      required: true,
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

    additionalCharges: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    documentUrl: {
      type: String,
      trim: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    status: {
      type: String,
      enum: [
        "submitted",
        "procurement_verified",
        "procurement_rejected",
        "finance_approved",
        "finance_rejected",
      ],
      default: "submitted",
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "partially_paid", "paid"],
      default: "pending",
      required: true,
    },

    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    procurementReviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    procurementReviewedAt: {
      type: Date,
    },

    procurementRemarks: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    financeApprovedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    financeApprovedAt: {
      type: Date,
    },

    financeRemarks: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  }
);

// A supplier cannot submit duplicate invoice numbers.
invoiceSchema.index(
  { supplierId: 1, invoiceNumber: 1 },
  { unique: true }
);

// Buyer invoice management.
invoiceSchema.index({
  buyerOrganizationId: 1,
  status: 1,
  createdAt: -1,
});

// Supplier invoice history.
invoiceSchema.index({
  supplierId: 1,
  createdAt: -1,
});

// Finance payment tracking.
invoiceSchema.index({
  paymentStatus: 1,
  dueDate: 1,
});

const Invoice = mongoose.model<IInvoice>(
  "Invoice",
  invoiceSchema
);

export default Invoice;
