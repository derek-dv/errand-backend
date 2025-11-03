const express = require(`express`);
const router = express.Router();
const userController = require(`../controllers/userController`);

router.get("/userName", userController.getUserName);
router.get("/userData", userController.getUserData);
router.get("/home", userController.getUserHomePage);
router.get("/me", userController.getProfile);
router.patch("/update", userController.updateProfile);
router.get("/saved-places", userController.getSavedPlaces);
router.post("/saved-places", userController.createSavedPlace);
router.put("/saved-places/:id", userController.updateSavedPlaces);
router.delete("/saved-places/:id", userController.deleteSavedPlace);

module.exports = router;
