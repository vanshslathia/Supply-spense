import { Document, Schema, Types, model } from "mongoose";

export interface IInventoryTransaction extends Document {
  buyerOrganizationId: Types.ObjectId;
  deliveryId: Types.ObjectId;
  purchaseOrderId: Types.ObjectId;
  inspectionId: Types.ObjectId;
  rfqItemId: Types.ObjectId;
  productId?: Types.ObjectId;
  warehouseLocationId?: Types.ObjectId;
  productName: string;
  quantity: number;
  acceptedQuantity?: number;
  rejectedQuantity?: number;
  onHoldQuantity?: number;
  category?: string;
  unit?: string;
  unitCost?: number;
  remarks?: string;
  transactionType: "qc_accepted_receipt" | "qc_disposition";
  createdBy: Types.ObjectId;
  postedAt: Date;
}

const inventoryTransactionSchema = new Schema<IInventoryTransaction>(
  {
    buyerOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      immutable: true,
      index: true,
    },
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
    inspectionId: {
      type: Schema.Types.ObjectId,
      ref: "Inspection",
      required: true,
      immutable: true,
    },
    rfqItemId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryProduct",
      immutable: true,
    },
    warehouseLocationId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      immutable: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
    },
    acceptedQuantity: {
      type: Number,
      min: 0,
      immutable: true,
    },
    rejectedQuantity: {
      type: Number,
      min: 0,
      immutable: true,
    },
    onHoldQuantity: {
      type: Number,
      min: 0,
      immutable: true,
    },
    category: {
      type: String,
      trim: true,
      immutable: true,
    },
    unit: {
      type: String,
      trim: true,
      immutable: true,
    },
    unitCost: {
      type: Number,
      min: 0,
      immutable: true,
    },
    remarks: {
      type: String,
      trim: true,
      immutable: true,
    },
    transactionType: {
      type: String,
      enum: ["qc_accepted_receipt", "qc_disposition"],
      required: true,
      immutable: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    postedAt: {
      type: Date,
      required: true,
      immutable: true,
    },
  },
  { timestamps: true }
);

inventoryTransactionSchema.index(
  { inspectionId: 1, rfqItemId: 1 },
  { unique: true }
);

export default model<IInventoryTransaction>(
  "InventoryTransaction",
  inventoryTransactionSchema
);
