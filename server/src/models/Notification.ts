import { Document, Schema, Types, model } from "mongoose";

export type NotificationType =
  | "delivery_created"
  | "shipment_status"
  | "delivery_arrived"
  | "goods_received"
  | "qc_handover"
  | "qc_completed"
  | "delivery_exception";

export interface INotification extends Document {
  recipientId: Types.ObjectId;
  organizationId?: Types.ObjectId;
  deliveryId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  readAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      immutable: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
      immutable: true,
    },
    deliveryId: {
      type: Schema.Types.ObjectId,
      ref: "Delivery",
      required: true,
      immutable: true,
    },
    type: {
      type: String,
      enum: [
        "delivery_created",
        "shipment_status",
        "delivery_arrived",
        "goods_received",
        "qc_handover",
        "qc_completed",
        "delivery_exception",
      ],
      required: true,
      immutable: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
      immutable: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
      immutable: true,
    },
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });

export default model<INotification>("Notification", notificationSchema);
