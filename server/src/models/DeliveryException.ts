import { Document, Schema, Types, model } from "mongoose";

export type DeliveryExceptionType =
  | "receiving_discrepancy"
  | "shipment_delay"
  | "qc_rejected"
  | "qc_on_hold";

export interface IDeliveryExceptionItem {
  rfqItemId: Types.ObjectId;
  productName: string;
  quantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  onHoldQuantity: number;
}

export interface IDeliveryException extends Document {
  deliveryId: Types.ObjectId;
  purchaseOrderId: Types.ObjectId;
  buyerOrganizationId: Types.ObjectId;
  inspectionId?: Types.ObjectId;
  type: DeliveryExceptionType;
  status: "open" | "resolved";
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  resolutionHistory: {
    action: "resolved";
    performedBy: Types.ObjectId;
    note?: string;
    changedAt: Date;
  }[];
  reason: string;
  items: IDeliveryExceptionItem[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IDeliveryExceptionItem>(
  {
    rfqItemId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    damagedQuantity: { type: Number, required: true, min: 0 },
    missingQuantity: { type: Number, required: true, min: 0 },
    acceptedQuantity: { type: Number, required: true, min: 0 },
    rejectedQuantity: { type: Number, required: true, min: 0 },
    onHoldQuantity: { type: Number, required: true, min: 0 },
  },
  { _id: false, timestamps: false }
);

const deliveryExceptionSchema = new Schema<IDeliveryException>(
  {
    deliveryId: {
      type: Schema.Types.ObjectId,
      ref: "Delivery",
      required: true,
      immutable: true,
      index: true,
    },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
      immutable: true,
    },
    buyerOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      immutable: true,
      index: true,
    },
    inspectionId: {
      type: Schema.Types.ObjectId,
      ref: "Inspection",
      immutable: true,
    },
    type: {
      type: String,
      enum: ["receiving_discrepancy", "shipment_delay", "qc_rejected", "qc_on_hold"],
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: Date,
    resolutionHistory: {
      type: [{
        action: { type: String, enum: ["resolved"], required: true },
        performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        note: { type: String, trim: true, maxlength: 2000 },
        changedAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
      immutable: true,
    },
    items: {
      type: [itemSchema],
      required: true,
      immutable: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
  },
  { timestamps: true }
);

deliveryExceptionSchema.index({ buyerOrganizationId: 1, status: 1, createdAt: -1 });

export default model<IDeliveryException>("DeliveryException", deliveryExceptionSchema);
