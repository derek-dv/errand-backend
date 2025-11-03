const SenderReceiver = require("../models/senderReceiver");

exports.getActivity = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await SenderReceiver.findById(userId).select(
      "lastLogin createdAt"
    );

    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    res.status(200).json({
      status: true,
      lastLogin: user.lastLogin,
      joinedAt: user.createdAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.changePhone = async (req, res) => {
  try {
    const userId = req.user.id;

    const { newPhone } = req.body;
    if (!newPhone) {
      return res
        .status(400)
        .json({ status: false, message: "New phone number is required" });
    }

    const existingUser = await SenderReceiver.findOne({
      phoneNumber: newPhone,
    });
    if (existingUser) {
      return res
        .status(409)
        .json({ status: false, message: "Phone number is already in use" });
    }

    const updatedUser = await SenderReceiver.findByIdAndUpdate(
      userId,
      { phoneNumber: newPhone },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    res.status(200).json({
      status: true,
      message: "Phone number updated",
      phoneNumber: updatedUser.phoneNumber,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.changeEmail = async (req, res) => {
  try {
    const userId = req.user.id;

    const { newEmail } = req.body;
    if (!newEmail) {
      return res
        .status(400)
        .json({ status: false, message: "New email is required" });
    }

    const emailInUse = await SenderReceiver.findOne({ email: newEmail });
    if (emailInUse) {
      return res
        .status(409)
        .json({ status: false, message: "Email is already in use" });
    }

    const updatedUser = await SenderReceiver.findByIdAndUpdate(
      userId,
      { email: newEmail },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    res.status(200).json({
      status: true,
      message: "Email updated successfully",
      email: updatedUser.email,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.logoutAll = async (req, res) => {
  try {
    const userId = req.user.id;

    // Simulate token invalidation via token versioning
    const updatedUser = await SenderReceiver.findByIdAndUpdate(
      userId,
      { $inc: { tokenVersion: 1 } }, // this will invalidate existing tokens if checked
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    res
      .status(200)
      .json({ status: true, message: "Logged out from all devices" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};
