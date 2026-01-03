import { AppError, catchErrorAsync } from "../../utils/catch-error.js";
import User from "../../../database/models/user.model.js";
import {messages} from '../../utils/constant/messages.js';
import { comparePass, hashPass } from "../../utils/hash-compare.js";
import { generateOTP } from "../../utils/otp.js";
import { sendEmail, sendResetPasswordMail } from "../../utils/emails/email.js";
import Token from "../../../database/models/token.model.js";
import { generateToken, verifyToken } from "../../utils/token.js";
import { status } from "../../utils/constant/enums.js";


export const signup = catchErrorAsync(async (req, res, next) => {
  let { userName, email, password, Cpassword, gender, mobileNumber } = req.body;
  const userExisting = await User.findOne({
    $or: [{ email }, { mobileNumber }],
  });
  if (userExisting) return next(new AppError(messages.user.alreadyExist, 409));
  if (password != Cpassword) {
    return next(new AppError("password and confirm password doesn't Match", 401))
  }

  const hashedPassword = hashPass({
    password,
    saltRounds: Number(process.env.SALT_ROUNDS)
  });

  const {otpCode, otpExpire} = generateOTP();

  const user = new User({
    userName,
    email,
    password: hashedPassword,
    gender,
    mobileNumber,
    otpCode,
    otpExpire,
    passwordChangedAt: Date.now(),
  });
  let createdUser = await user.save();
  if (!createdUser) return next(new AppError(messages.user.failToCreate, 500));

  const token = await sendEmail(
    createdUser._id,
    createdUser.email,
    createdUser.role,
    otpCode
  );

  await Token.create({
    token,
    userId: createdUser._id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  createdUser.password = undefined;

  return res.status(201).json({
    message: messages.user.createdSuccessfully,
    success: true,
    data: createdUser,
  });
});

//===> verify your account
export const verifyAccount = catchErrorAsync(async (req, res, next) => {
  const { token } = req.params;
  const decoded = await verifyToken({
    token: req.params.token,
    secretKey: process.env.EMAIL_KEY,
  });

  if (!decoded || !decoded._id) {
    return next(new AppError("Invalid Token or Signature...", 401));
  }
  const user = await User.findOneAndUpdate(
    { _id: decoded._id, status: status.PENDING },
    {
      status: status.VERIFIED,
      isVerified: true,
      otpCode: null,
      otpExpire: null,
    },
    {
      new: true,
    }
  );
  if (!user) return next(new AppError(messages.user.notFound, 404));
  // TOD create cart when verification

  res.json({
    message: messages.user.verifiedSuccessfully,
    success: true,
    data: decoded.email,
  });
});


export const logIn = catchErrorAsync(async (req, res, next) => {
  let { email, mobileNumber, password } = req.body;
  
  //check existence
  const userExist = await User.findOne({
    $or: [{ email }, { mobileNumber }],
    status: status.VERIFIED, //must verified to login
  });
  
  if (!userExist) {
    return next(new AppError(messages.user.invalidCredential, 401));
  }
  
  //check password
  const isMatch = comparePass({
    password: password.trim(),
    hashPass: userExist.password,
  });

  if (!isMatch) {
    return next(new AppError(messages.user.invalidCredential, 401));
  }

  if (userExist.status !== status.VERIFIED || userExist.otpCode != null) {
    return next(new AppError(messages.user.notVerified, 401));
  }

  // Fix: Only update if user is not already active
  if (!userExist.isActive) {
    userExist.isActive = true;
    await userExist.save();
  }

  const accessToken = await generateToken({
    payload: {
      _id: userExist._id,
      name: userExist.userName,
      email: userExist.email,
      role: userExist.role,
    },
  });
  
  await Token.create({
    token: accessToken,
    userId: userExist._id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  res.json({
    message: messages.user.loggedInSuccessfully,
    success: true,
    accessToken,
  });
});


export const forgetPassword = catchErrorAsync(async(req, res, next) => {
  const {email} = req.body;
  const userExist = await User.findOne({email});
  if (!userExist) return next(new AppError(messages.user.notFound, 404));
  if (userExist.otpCode && userExist.otpExpire > Date.now()) {
    return next(new AppError(messages.user.hasOTP, 404));
  }
  const {otpCode, otpExpire} = generateOTP();
  // update user OTP
  userExist.otpCode = otpCode;
  userExist.otpExpire = otpExpire;
  await userExist.save();
  await sendResetPasswordMail(email, otpCode);
   // return res
  return res.json({ message: "check your email", success: true });
});

export const logout = catchErrorAsync(async (req, res, next) => {
  const {_id} = req.authUser;
  const authHeader = req.headers.authentication;
  if (!authHeader) return next(new AppError("No token provided", 401));
  const token = authHeader.split(" ")[1];
  await User.findByIdAndUpdate(_id, {
    isActive:false
  });
  await Token.findByIdAndUpdate(
    {token},
    {isValid: false}
  );
  res.status(200).json({
    message: messages.user.loggedOutSuccessfully,
    success: true,
  });
});

export const verifyOtp = catchErrorAsync(async (req, res, next) => {
  const { email, otpCode } = req.body;
  const user = await User.findOne({ email });
  if (!user) return next(new AppError(messages.user.notFound, 404));
  if (user.otpCode !== otpCode)
    return next(new AppError(messages.user.invalidOTP, 401));
  if (user.otpExpire < new Date())
    return next(new AppError(messages.user.expireOTP, 400));
  await User.findOneAndUpdate(
    { email },
    {
      isVerified: true,
      otpCode: null,
      otpExpire: null,
      status: status.VERIFIED,
    },
    { new: true }
  );
  res.json({ message: messages.user.verifiedSuccessfully });
});
export const changePassword = catchErrorAsync(async(req, res, next) => {
  const {otp, newPass, email} = req.body;
  
  console.log("DEBUG: Received OTP:", otp);
  console.log("DEBUG: Received email:", email);
  
  // Find user by email
  const user = await User.findOne({email});
  if (!user) {
    console.log("DEBUG: User not found for email:", email);
    return next(new AppError(messages.user.notFound, 404));
  }
  
  // Check if OTP matches
  if (String(user.otpCode) !== String(otp).trim()) {
    return next(new AppError(messages.user.invalidOTP, 401));
  }
  
  // Check if OTP is expired
  if (!user.otpExpire || user.otpExpire < Date.now()) {
    console.log("DEBUG: OTP expired or invalid expire date");
    return next(new AppError("OTP has expired. Please request a new one.", 401));
  }
  
  // Hash new password
  const hashedPassword = hashPass({ 
    password: newPass,
    saltRounds: Number(process.env.SALT_ROUNDS)
  });
  
  // Update user password
  await User.updateOne(
    { email },
    {
      password: hashedPassword,
      otpCode: null,
      otpExpire: null,
      passwordChangedAt: Date.now(),
    }
  );
  
  // Invalidate old tokens
  await Token.updateMany({ userId: user._id }, { isValid: false });
  
  // Generate new token
  const accessToken = await generateToken({
    payload: {
      _id: user._id,
      name: user.userName,
      email: user.email,
      role: user.role,
    },
  });
  
  // Create new token
  await Token.create({
    token: accessToken,
    userId: user._id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  
  return res.status(200).json({
    message: messages.password.updatedSuccessfully,
    success: true,
    accessToken,
  });
});