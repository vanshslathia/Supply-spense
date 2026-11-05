
import mongoose, { Schema, Document, Types } from "mongoose";

export type RFQStatus =
  | "draft"
  | "published"
  | "closed"
  | "cancelled";

export type RFQVisibility =
  | "open"
  | "invited";

export interface IRFQItem {
  productName: string;
  description?: string;
  category: string;
  quantity: number;
  unit: string;
  specifications?: string;
}

export interface IRFQ extends Document {
  rfqNumber: string;

  title: string;
  description: string;
  category: string;

  items: Types.DocumentArray<IRFQItem>;

  buyerOrganizationId: Types.ObjectId;
  createdBy: Types.ObjectId;

  visibility: RFQVisibility;
  invitedSuppliers: Types.ObjectId[];

  deliveryLocation: string;
  deliveryDate: Date;
  submissionDeadline: Date;

  status: RFQStatus;

  createdAt: Date;
  updatedAt: Date;
}

const rfqItemSchema = new Schema<IRFQItem>(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },

    specifications: {
      type: String,
      trim: true,
    },
  },
  {
    _id: true,
  }
);

const rfqSchema = new Schema<IRFQ>(
  {
    rfqNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    items: {
      type: [rfqItemSchema],
      required: true,
      validate: {
        validator: (items: IRFQItem[]) => items.length > 0,
        message: "An RFQ must contain at least one item.",
      },
    },

    buyerOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    visibility: {
      type: String,
      enum: ["open", "invited"],
      default: "open",
    },

    invitedSuppliers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    deliveryLocation: {
      type: String,
      required: true,
      trim: true,
    },

    deliveryDate: {
      type: Date,
      required: true,
    },

    submissionDeadline: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["draft", "published", "closed", "cancelled"],
      default: "draft",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Useful for supplier RFQ listing and filtering
rfqSchema.index({
  status: 1,
  visibility: 1,
  submissionDeadline: 1,
});

rfqSchema.index({
  buyerOrganizationId: 1,
  createdAt: -1,
});

const RFQ = mongoose.model<IRFQ>("RFQ", rfqSchema);

export default RFQ;
