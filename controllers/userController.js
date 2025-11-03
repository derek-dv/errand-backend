const SenderReceiver = require("../models/senderReceiver");

exports.getUserName = async (req, res) => {
  try {
    const userId = req.user.id; // assuming JWT middleware sets req.user

    const user = await SenderReceiver.findById(userId, "fullName").lean();

    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    res.status(200).json({
      status: true,
      user: {
        username: user.fullName,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getUserHomePage = async (req, res) => {
  try {
    const userId = req.user.id; // assuming JWT middleware sets req.user

    const user = await SenderReceiver.findById(
      userId,
      "fullName savedPlaces.work"
    ).lean();

    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    res.status(200).json({
      status: true,
      user: {
        username: user.fullName,
        workLocation: user.savedPlaces?.work || null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getUserData = async (req, res) => {
  try {
    const userId = req.user.id; // assuming JWT middleware sets req.user

    // Fetch only the fields you want
    const user = await SenderReceiver.findById(
      userId,
      "fullName email phoneNumber savedPlaces"
    ).lean();

    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    res.status(200).json({
      status: true,
      user: {
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        savedPlaces: user.savedPlaces || {},
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // assuming JWT middleware sets req.user

    const user = await SenderReceiver.findById(userId)
      .populate("deliveryHistory")
      .populate("notifications")
      .populate("wallet")
      .populate("giftCards")
      .populate("settings")
      .lean();

    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    res.status(200).json({ status: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const allowedFields = ["fullName", "email", "profilePhoto", "phoneNumber"];
    const updates = {};

    for (let field of allowedFields) {
      if (req.body[field]) updates[field] = req.body[field];
    }

    const updatedUser = await SenderReceiver.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    res.status(200).json({ status: true, user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.createSavedPlace = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, label, address, lat, lng } = req.body;

    // Validate type
    if (!["home", "work", "custom"].includes(type)) {
      return res.status(400).json({
        status: false,
        message: "Type must be 'home', 'work', or 'custom'",
      });
    }

    if (!address || lat === undefined || lng === undefined) {
      return res.status(400).json({
        status: false,
        message: "Address, lat, and lng are required",
      });
    }

    const newPlace = {
      label: label || type.charAt(0).toUpperCase() + type.slice(1),
      address,
      coordinates: { lat, lng },
    };

    const user = await SenderReceiver.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    // Handle logic
    if (user.savedPlaces[type]) {
      return res.status(400).json({
        status: false,
        message: `${
          type.charAt(0).toUpperCase() + type.slice(1)
        } location already exists. Update savedPlace instead.`,
      });
    }

    user.savedPlaces[type] = newPlace;

    await user.save();

    res.status(201).json({
      status: true,
      message: `${type} saved place created successfully`,
      savedPlace: user.savedPlaces[type],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getSavedPlaces = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await SenderReceiver.findById(userId).select("savedPlaces");
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    res.status(200).json({ status: true, savedPlaces: user.savedPlaces });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.updateSavedPlaces = async (req, res) => {
  try {
    const userId = req.user.id;
    const placeId = req.params.id; // ID of the savedPlace to update
    const { type, label, address, lat, lng } = req.body;

    // Validate type
    if (!["home", "work", "custom"].includes(type)) {
      return res.status(400).json({
        status: false,
        message: "Type must be 'home', 'work', or 'custom'",
      });
    }

    const user = await SenderReceiver.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const updatedLocation = {
      label: label || type.charAt(0).toUpperCase() + type.slice(1),
      address,
      coordinates: { lat, lng },
    };

    let updated = false;

    // Update logic for home/work/custom (single object each)
    const place = user.savedPlaces[type];
    if (place && place._id?.toString() === placeId) {
      user.savedPlaces[type].set(updatedLocation);
      updated = true;
    }

    if (!updated) {
      return res.status(404).json({
        status: false,
        message: "Saved place with the given ID not found or type mismatch",
      });
    }

    await user.save();

    res.status(200).json({
      status: true,
      message: `${type} location updated successfully`,
      savedPlaces: user.savedPlaces,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.deleteSavedPlace = async (req, res) => {
  try {
    const userId = req.user.id;
    const placeId = req.params.id;

    const user = await SenderReceiver.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    let deleted = false;

    // Check and delete home
    if (
      user.savedPlaces.home &&
      user.savedPlaces.home._id?.toString() === placeId
    ) {
      user.savedPlaces.home = undefined;
      deleted = true;
    }

    // Check and delete work
    if (
      user.savedPlaces.work &&
      user.savedPlaces.work._id?.toString() === placeId
    ) {
      user.savedPlaces.work = undefined;
      deleted = true;
    }

    // Check and delete custom (single object now)
    if (
      user.savedPlaces.custom &&
      user.savedPlaces.custom._id?.toString() === placeId
    ) {
      user.savedPlaces.custom = undefined;
      deleted = true;
    }

    if (!deleted) {
      return res.status(404).json({
        status: false,
        message: "Saved place with the given ID not found",
      });
    }

    await user.save();

    res.status(200).json({
      status: true,
      message: "Saved place deleted",
      savedPlaces: user.savedPlaces,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};
