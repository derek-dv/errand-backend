const express = require("express");
const router = express.Router();
const giftCardController = require("../controllers/giftCardController");

router.get("/", giftCardController.getAll);
router.post("/buy", giftCardController.buy);
router.post("/redeem", giftCardController.redeem);

module.exports = router;
