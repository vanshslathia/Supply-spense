
import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./modules/auth/auth.routes";
import sessionMiddleware from "./config/session";
import rfqRoutes from "./modules/rfq/rfq.routes";
import quotationRoutes from "./modules/quotation/quotation.routes";
import purchaseOrderRoutes from "./modules/purchase-order/purchase-order.routes";
import deliveryRoutes from "./modules/delivery/delivery.routes";
import invoiceRoutes from "./modules/invoice/invoice.routes";
import paymentRoutes from "./modules/payment/payment.routes";
import adminRoutes from "./modules/admin/admin.routes";
import notificationRoutes from "./modules/notification/notification.routes";
import inventoryRoutes from "./modules/inventory/inventory.routes";
import { enforceActiveOrganization } from "./middleware/auth.middleware";





const app = express();


app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);



app.use(express.json({ limit: "1mb" }));
app.use(sessionMiddleware);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "SupplySense AI API is running",
  });
});

app.use(enforceActiveOrganization);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/rfqs", rfqRoutes);

app.use("/api/quotations", quotationRoutes);

app.use("/api/purchase-orders", purchaseOrderRoutes);

app.use("/api/deliveries", deliveryRoutes);

app.use("/api/notifications", notificationRoutes);

app.use("/api/invoices", invoiceRoutes);

app.use("/api/payments", paymentRoutes);
app.use("/api/inventory", inventoryRoutes);





export { app };
export default app;
