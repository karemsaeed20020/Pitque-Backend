import nodemailer from "nodemailer";
import { generateToken } from "../token.js";
import { emailtemplet } from "./email-templet.js";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SENDEMAIL,
    pass: process.env.SENDEMAILPASSWORD,
  },
});

export const sendEmail = async (_id, email, role, otpCode) => {
  const token = await generateToken({
    payload: { _id, email, role },
    secretKey: process.env.EMAIL_KEY,
  });

  const info = await transporter.sendMail({
    from: `"BETCLINIC 🐶🐱" <${process.env.SENDEMAIL}>`,
    to: email,
    subject: "Confirm Email",
    text: `Your OTP code is ${otpCode}`,
    html: emailtemplet(token, otpCode),
  });
  console.log("Message sent: %s", info.messageId);
  return token;
};
