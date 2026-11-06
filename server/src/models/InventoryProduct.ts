import { Schema, Types, model } from "mongoose";

export interface IInventoryProduct {
  buyerOrganizationId: Types.ObjectId;
  sourceRfqItemId: Types.ObjectId;
  sku: string;
  productName: string;
  category: string;
  unit: string;
  reorderLevel: number;
  warehouseLocationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryProductSchema = new Schema<IInventoryProduct>(
  {
    buyerOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      immutable: true,
      index: true,
    },
    sourceRfqItemId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    reorderLevel: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    warehouseLocationId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseLocation",
    },
  },
  { timestamps: true }
);

inventoryProductSchema.index(
  { buyerOrganizationId: 1, sourceRfqItemId: 1 },
  { unique: true }
);
inventoryProductSchema.index(
  { buyerOrganizationId: 1, sku: 1 },
  { unique: true }
);

export default model<IInventoryProduct>("InventoryProduct", inventoryProductSchema);
