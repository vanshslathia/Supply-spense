
import mongoose, { Schema, Document, Types } from "mongoose";

// ==========================================
// INSPECTION TYPES
// ==========================================

export type InspectionStatus =
  | "draft"
  | "in_progress"
  | "completed";

export type InspectionDecision =
  | "pending"
  | "passed"
  | "rejected"
  | "on_hold";

export type SampleResult =
  | "passed"
  | "defective";

export type DefectSeverity = "minor" | "major" | "critical";

export interface IProductDisposition {
  productId: string;
  acceptedQuantity: number;
  rejectedQuantity: number;
  onHoldQuantity: number;
  remarks?: string;
}

export interface IInspectedUnit {
  productId: string;
  result: SampleResult;
  defectCategory?: string;
  defectDescription?: string;
  severity?: DefectSeverity;
  evidenceUrls: string[];
  remarks?: string;
}

export interface IInspectionHistory {
  action: string;
  performedBy: Types.ObjectId;
  note?: string;
  changedAt: Date;
}

// ==========================================
// INSPECTION INTERFACE
// ==========================================

export interface IInspection extends Document {
  inspectionNumber: string;

  deliveryId: Types.ObjectId;
  purchaseOrderId: Types.ObjectId;
  buyerOrganizationId: Types.ObjectId;

  inspectorId: Types.ObjectId;

  sampleSize: number;
  rejectionThreshold: number;

  inspectedUnits: IInspectedUnit[];
  productDispositions: IProductDisposition[];
  holdReason?: string;

  totalSampled: number;
  defectiveCount: number;
  passedCount: number;

  status: InspectionStatus;
  decision: InspectionDecision;

  inspectionNotes?: string;

  startedAt?: Date;
  completedAt?: Date;

  history: IInspectionHistory[];

  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// INSPECTED UNIT SCHEMA
// ==========================================

const inspectedUnitSchema = new Schema<IInspectedUnit>(
  {
    productId: {
      type: String,
      required: true,
      trim: true,
    },

    result: {
      type: String,
      enum: ["passed", "defective"],
      required: true,
    },

    defectCategory: {
      type: String,
      trim: true,
    },

    defectDescription: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    severity: {
      type: String,
      enum: ["minor", "major", "critical"],
    },

    evidenceUrls: {
      type: [String],
      default: [],
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  { _id: false }
);

const productDispositionSchema = new Schema<IProductDisposition>(
  {
    productId: {
      type: String,
      required: true,
      trim: true,
    },
    acceptedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    rejectedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    onHoldQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  { _id: false }
);

// ==========================================
// INSPECTION HISTORY SCHEMA
// ==========================================

const inspectionHistorySchema =
  new Schema<IInspectionHistory>(
    {
      action: {
        type: String,
        required: true,
        trim: true,
      },

      performedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      note: {
        type: String,
        trim: true,
        maxlength: 2000,
      },

      changedAt: {
        type: Date,
        default: Date.now,
      },
    },
    { _id: false }
  );

// ==========================================
// INSPECTION SCHEMA
// ==========================================

const inspectionSchema = new Schema<IInspection>(
  {
    inspectionNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    deliveryId: {
      type: Schema.Types.ObjectId,
      ref: "Delivery",
      required: true,
      index: true,
    },

    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
      index: true,
    },

    buyerOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    inspectorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Number of units selected for inspection
    sampleSize: {
      type: Number,
      required: true,
      min: 1,
    },

    // Number of defective samples required to trigger rejection
    rejectionThreshold: {
      type: Number,
      required: true,
      min: 1,
    },

    inspectedUnits: {
      type: [inspectedUnitSchema],
      default: [],
    },

    productDispositions: {
      type: [productDispositionSchema],
      default: [],
    },

    holdReason: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    totalSampled: {
      type: Number,
      default: 0,
      min: 0,
    },

    defectiveCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    passedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["draft", "in_progress", "completed"],
      default: "draft",
      index: true,
    },

    decision: {
      type: String,
      enum: ["pending", "passed", "rejected", "on_hold"],
      default: "pending",
      index: true,
    },

    inspectionNotes: {
      type: String,
      trim: true,
      maxlength: 3000,
    },

    startedAt: {
      type: Date,
    },

    completedAt: {
      type: Date,
    },

    history: {
      type: [inspectionHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================
// INDEXES
// ==========================================

inspectionSchema.index({
  buyerOrganizationId: 1,
  status: 1,
  createdAt: -1,
});

inspectionSchema.index({
  deliveryId: 1,
  createdAt: -1,
});

inspectionSchema.index({
  inspectorId: 1,
  status: 1,
});

// ==========================================
// MODEL
// ==========================================

const Inspection = mongoose.model<IInspection>(
  "Inspection",
  inspectionSchema
);

export default Inspection;
