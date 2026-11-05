
import mongoose, { Schema, Document, Types } from "mongoose";

export type PurchaseOrderStatus =
  | "draft"
  | "issued"
  | "acknowledged"
  | "rejected"
  | "in_progress"
  | "partially_delivered"
  | "delivered"
  | "cancelled";

export interface IPurchaseOrderItem {
  rfqItemId: Types.ObjectId;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface IPurchaseOrder extends Document {
  poNumber: string;

  rfqId: Types.ObjectId;
  quotationId: Types.ObjectId;

  supplierId: Types.ObjectId;
  buyerOrganizationId: Types.ObjectId;

  items: IPurchaseOrderItem[];

  subtotal: number;
  taxPercentage: number;
  taxAmount: number;
  deliveryCharges: number;
  totalAmount: number;

  deliveryLocation: string;
  deliveryDate: Date;

  deliveryTimeline: number;
  paymentTerms?: string;
  notes?: string;

  status: PurchaseOrderStatus;

  issuedAt?: Date;
  acknowledgedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;

  createdBy: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const purchaseOrderItemSchema = new Schema<IPurchaseOrderItem>(
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
  },
  { _id: false }
);

const purchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    poNumber: {
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

    quotationId: {
      type: Schema.Types.ObjectId,
      ref: "Quotation",
      required: true,
      unique: true,
    },

    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    buyerOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    items: {
      type: [purchaseOrderItemSchema],
      required: true,
      validate: {
        validator: (items: IPurchaseOrderItem[]) =>
          items.length > 0,
        message: "A purchase order must contain at least one item.",
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

    deliveryLocation: {
      type: String,
      required: true,
      trim: true,
    },

    deliveryDate: {
      type: Date,
      required: true,
    },

    deliveryTimeline: {
      type: Number,
      required: true,
      min: 1,
    },

    paymentTerms: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
    },

    status: {
      type: String,
      enum: [
        "draft",
        "issued",
        "acknowledged",
        "rejected",
        "in_progress",
        "partially_delivered",
        "delivered",
        "cancelled",
      ],
      default: "draft",
      required: true,
    },

    issuedAt: Date,
    acknowledgedAt: Date,
    rejectedAt: Date,

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Procurement dashboard queries
purchaseOrderSchema.index({
  buyerOrganizationId: 1,
  status: 1,
  createdAt: -1,
});

// Supplier dashboard queries
purchaseOrderSchema.index({
  supplierId: 1,
  status: 1,
  createdAt: -1,
});

const PurchaseOrder = mongoose.model<IPurchaseOrder>(
  "PurchaseOrder",
  purchaseOrderSchema
);

export default PurchaseOrder;
