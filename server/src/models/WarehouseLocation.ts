import { Schema, Types, model } from "mongoose";

export interface IWarehouseLocation {
  buyerOrganizationId: Types.ObjectId;
  code: string;
  name: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const warehouseLocationSchema = new Schema<IWarehouseLocation>(
  {
    buyerOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      immutable: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

warehouseLocationSchema.index(
  { buyerOrganizationId: 1, code: 1 },
  { unique: true }
);

export default model<IWarehouseLocation>("WarehouseLocation", warehouseLocationSchema);
