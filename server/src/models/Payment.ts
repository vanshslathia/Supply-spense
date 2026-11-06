
import mongoose, { Schema, Document, Types } from "mongoose";

export type PaymentMethod =
  | "bank_transfer"
  | "upi"
  | "neft"
  | "rtgs"
  | "imps"
  | "cheque"
  | "other";

export type PaymentStatus =
  | "pending"
  | "completed"
  | "failed"
  | "reversed";

export interface IPaymentStatusHistory {
  fromStatus: PaymentStatus;
  toStatus: PaymentStatus;
  changedBy: Types.ObjectId;
  changedAt: Date;
  remarks?: string;
}

export interface IPayment extends Document {
  paymentNumber: string;

  invoiceId: Types.ObjectId;
  purchaseOrderId: Types.ObjectId;
  supplierId: Types.ObjectId;
  buyerOrganizationId: Types.ObjectId;

  amount: number;
  currency: string;

  paymentMethod: PaymentMethod;
  transactionReference?: string;

  paymentDate: Date;
  status: PaymentStatus;

  recordedBy: Types.ObjectId;
  remarks?: string;

  statusHistory: IPaymentStatusHistory[];

  createdAt: Date;
  updatedAt: Date;
}

const paymentStatusHistorySchema =
  new Schema<IPaymentStatusHistory>(
    {
      fromStatus: {
        type: String,
        enum: ["pending", "completed", "failed", "reversed"],
        required: true,
      },

      toStatus: {
        type: String,
        enum: ["pending", "completed", "failed", "reversed"],
        required: true,
      },

      changedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      changedAt: {
        type: Date,
        default: Date.now,
        required: true,
      },

      remarks: {
        type: String,
        trim: true,
        maxlength: 2000,
      },
    },
    {
      _id: true,
    }
  );

const paymentSchema = new Schema<IPayment>(
  {
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },

    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
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
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },

    paymentMethod: {
      type: String,
      enum: [
        "bank_transfer",
        "upi",
        "neft",
        "rtgs",
        "imps",
        "cheque",
        "other",
      ],
      required: true,
    },

    transactionReference: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 150,
      set: (value: string | undefined) =>
        value?.trim().toUpperCase() || undefined,
    },

    paymentDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "completed", "failed", "reversed"],
      default: "pending",
      required: true,
    },

    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    statusHistory: {
      type: [paymentStatusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Payment history for invoices.
paymentSchema.index({
  invoiceId: 1,
  paymentDate: -1,
});

// Organization payment tracking.
paymentSchema.index({
  buyerOrganizationId: 1,
  status: 1,
  paymentDate: -1,
});

// Supplier payment history.
paymentSchema.index({
  supplierId: 1,
  paymentDate: -1,
});

// Prevent duplicate transaction references within an organization.
paymentSchema.index(
  {
    buyerOrganizationId: 1,
    transactionReference: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      transactionReference: { $type: "string" },
    },
    name: "unique_org_transaction_reference",
  }
);

const Payment = mongoose.model<IPayment>(
  "Payment",
  paymentSchema
);

export default Payment;
