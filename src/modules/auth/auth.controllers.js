import { AppError, catchErrorAsync } from "../../utils/catch-error.js";
import User from "../../../database/models/user.model.js";
import {messages} from '../../utils/constant/messages.js';
import { hashPass } from "../../utils/hash-compare.js";
import { generateOTP } from "../../utils/otp.js";
import { sendEmail } from "../../utils/emails/email.js";
import Token from "../../../database/models/token.model.js";


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
