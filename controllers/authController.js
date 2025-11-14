const admin = require("../firebase");
const SenderReceiver = require("../models/senderReceiver");
const Otp = require(`../models/otp`);
const { generateToken } = require("../utils/jwt");

// Function to request for phone Otp code
exports.sendOtp = async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber)
    return res
      .status(400)
      .json({ status: false, message: "Phone number required" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await Otp.create({ phone: phoneNumber, code, expiresAt });
  console.log(code);
  

  try {
    const client = require("twilio")(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    console.log("Sending OTP", code, "to", phoneNumber);
    await client.messages.create({
      body: `Your Aerrand OTP code is ${code}`,
      from: process.env.TWILIO_PHONE,
      to: phoneNumber,
    });
    res.status(200).json({ status: true, message: "OTP sent successfully" });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "Failed to send OTP",
      error: err.message,
    });
  }
};

// Function to validate the otp code
exports.verifyOtpAndLogin = async (req, res) => {
  const { phoneNumber, code } = req.body;
  const otpRecord = await Otp.findOne({ phone: phoneNumber, code });

  if (!otpRecord)
    return res.status(400).json({ status: false, message: "Invalid OTP" });
  if (otpRecord.expiresAt < new Date())
    return res
      .status(400)
      .json({ status: false, message: "OTP expired, request a new code" });

  let user = await SenderReceiver.findOne({ phoneNumber });
  if (!user) {
    user = await SenderReceiver.create({
      authProvider: "phone",
      phoneNumber,
      fullName: "User",
    });
  }
  await Otp.deleteMany({ phone: phoneNumber });
  const token = generateToken(user._id);
  return res.status(200).json({
    status: true,
    message: `OTP verified and login successful`,
    user,
    token,
  });
};

exports.loginWithGoogle = async (req, res) => {
  const { idToken } = req.body;

  try {
    // ✅ 1. Verify ID token using Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    const { uid, email, name, picture } = decodedToken;

    // ✅ 2. Check if user exists in MongoDB
    let user = await SenderReceiver.findOne({ googleId: uid });

    // ✅ 3. If not, create a new user
    if (!user) {
      user = await SenderReceiver.create({
        authProvider: "google",
        googleId: uid,
        email,
        fullName: name,
        profilePhoto: picture,
      });
    }

    // ✅ 4. Generate app-specific JWT token (optional, for your own session handling)
    const token = generateToken(user._id);

    // ✅ 5. Respond to client
    res.status(200).json({
      status: true,
      message: "Google login successful",
      user,
      token,
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(401).json({
      status: false,
      message: "Google login failed",
      error: error.message,
    });
  }
};

exports.loginWithApple = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        status: false,
        message: "idToken is required",
      });
    }

    // Verify the Firebase ID token (issued after Apple Sign-In)
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid: firebaseUid, email, name } = decodedToken;

    // Lookup or create the user in your DB
    let user = await SenderReceiver.findOne({ firebaseUid });
    if (!user) {
      user = await SenderReceiver.create({
        authProvider: "apple",
        firebaseUid,
        email,
        fullName: name || "Apple User",
      });
    }

    // Generate your custom JWT token for your session logic
    const token = generateToken(user._id);

    return res.status(200).json({
      status: true,
      message: "Apple login successful",
      user,
      token,
    });
  } catch (error) {
    console.error("Apple login failed:", error.message);
    return res.status(401).json({
      status: false,
      message: "Invalid or expired token",
      error: error.message,
    });
  }
};
