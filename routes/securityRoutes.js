const express = require(`express`);
const router = express.Router();
const securityController = require(`../controllers/securityController`);

router.get("/activity", securityController.getActivity);
router.put("/change-phone", securityController.changePhone);
router.put("/change-email", securityController.changeEmail);
router.post("/logout-all", securityController.logoutAll);

module.exports = router;
