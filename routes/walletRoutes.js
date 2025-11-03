const express = require("express");
const router = express.Router();
const walletController = require("../controllers/walletController");

router.get("/", walletController.getWallet);
router.post("/topup", walletController.topUp);
router.put("/auto-refill", walletController.toggleRefill);
router.get("/payment-methods", walletController.getMethods);
router.post("/payment-methods", walletController.addMethod);
router.delete("/payment-methods/:id", walletController.removeMethod);

module.exports = router;
