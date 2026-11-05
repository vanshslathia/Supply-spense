import mongoose, { Schema, Document } from "mongoose";

export interface IOrganization extends Document {
  name: string;
  organizationCode: string;
  email: string;
  industry?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    organizationCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    industry: {
      type: String,
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
  {
    timestamps: true,
  }
);

const Organization = mongoose.model<IOrganization>(
  "Organization",
  organizationSchema
);

export default Organization;