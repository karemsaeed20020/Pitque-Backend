import { AppError, catchErrorAsync } from "../../utils/catch-error.js";
import User from "../../../database/models/user.model.js";
import {messages} from '../../utils/constant/messages.js';
import { comparePass, hashPass } from "../../utils/hash-compare.js";
import { generateOTP } from "../../utils/otp.js";
import { sendEmail } from "../../utils/emails/email.js";
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