const SenderReceiver = require("../models/senderReceiver");
const Settings = require("../models/settings");

exports.getSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await SenderReceiver.findById(userId).populate("settings");

    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    res.status(200).json({ status: true, settings: user.settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    const allowedFields = ["language", "theme", "notificationsEnabled"];
    const updates = {};
    for (let field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const user = await SenderReceiver.findById(userId);
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    let settings;
    if (user.settings) {
      settings = await Settings.findByIdAndUpdate(
        user.settings,
        { $set: updates },
        { new: true, runValidators: true }
      );
    } else {
      settings = await Settings.create(updates);
      user.settings = settings._id;
      await user.save();
    }

    res
      .status(200)
      .json({ status: true, message: "Settings updated", settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await SenderReceiver.findById(userId).select(
      "notificationPreferences"
    );
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    res
      .status(200)
      .json({ status: true, preferences: user.notificationPreferences });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const { sms, email, push } = req.body;

    const user = await SenderReceiver.findById(userId);
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    if (!user.settings)
      return res
        .status(400)
        .json({ status: false, message: "No settings found for user" });

    const updatedSettings = await Settings.findByIdAndUpdate(
      user.settings,
      {
        $set: {
          notificationPreferences: {
            sms: sms !== undefined ? sms : true,
            email: email !== undefined ? email : true,
            push: push !== undefined ? push : true,
          },
        },
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: true,
      message: "Notification preferences updated",
      preferences: updatedSettings.notificationPreferences,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getLegal = async (req, res) => {
  try {
    // This would typically come from a database or static file in production
    const legal = {
      termsAndConditions:
        "By using the Errand App, you agree to our terms of service...",
      privacyPolicy: "We value your privacy. Here's how we handle your data...",
    };

    res.status(200).json({ status: true, legal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};
