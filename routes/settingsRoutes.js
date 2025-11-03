const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");

router.get("/", settingsController.getSettings);
router.patch("/", settingsController.updateSettings);
router.get(
  "/notification-preferences",
  settingsController.getNotificationPreferences
);
router.patch(
  "/notification-preferences",
  settingsController.updateNotificationPreferences
);
router.get("/legal", settingsController.getLegal);

module.exports = router;
