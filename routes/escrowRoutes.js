const express = require("express");
const router = express.Router();
const escrowController = require("../controllers/escrowController");

router.post("/initiate", escrowController.initiateEscrow);
router.patch("/update-status", escrowController.updateEscrowStatus);

module.exports = router;
