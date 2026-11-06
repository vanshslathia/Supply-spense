import { Router } from "express";
import {
  createOrganizationController,
  getOrganizationController,
  listOrganizationsController,
  updateOrganizationController,
  updateOrganizationStatusController,
} from "./organization.controller";
import {
  authenticateUser,
  authorizeRoles,
} from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticateUser, authorizeRoles("admin"));

router
  .route("/")
  .get(listOrganizationsController)
  .post(createOrganizationController);

router
  .route("/:organizationId")
  .get(getOrganizationController)
  .patch(updateOrganizationController);

router.patch(
  "/:organizationId/status",
  updateOrganizationStatusController
);

export default router;
