const express = require("express");
const router = express.Router();
const deliveryController = require(`../controllers/deliveryController`);

router.post("/quote", deliveryController.quote);
router.post("/create", deliveryController.create);
router.post("/:id/confirm", deliveryController.confirm);
router.post("/:id/broadcast", deliveryController.broadcast);
// router.get("/upcoming", deliveryController.getUpcoming);
// router.get("/history", deliveryController.getPast);
// router.get("/options/list", deliveryController.getOptions);
// router.get("/:id", deliveryController.getOne);
// router.patch("/:id/cancel", deliveryController.cancel);
// router.post("/:id/repeat", deliveryController.repeat);
// router.patch("/:id/confirm-location", deliveryController.confirmLocation);

module.exports = router;
