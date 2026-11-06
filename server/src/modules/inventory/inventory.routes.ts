import { Router } from "express";
import { authenticateUser, authorizeRoles } from "../../middleware/auth.middleware";
import {
  getInventoryLedgerController,
  getInventoryLocationsController,
  getInventoryOverviewController,
  getInventoryProductsController,
  updateInventoryReorderLevelController,
} from "./inventory.controller";

const router = Router();

router.use(authenticateUser, authorizeRoles("admin", "procurement", "warehouse"));
router.get("/overview", getInventoryOverviewController);
router.get("/products", getInventoryProductsController);
router.get("/locations", getInventoryLocationsController);
router.get("/ledger", getInventoryLedgerController);
router.patch("/products/:productId/reorder-level", updateInventoryReorderLevelController);

export default router;
