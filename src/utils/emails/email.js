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


export async function sendResetPasswordMail(email, otpCode) {
  const info = await transporter.sendMail({
    from: `"BETCLINIC 🐾" <${process.env.SENDEMAIL}>`,
    to: email,
    subject: "Reset Your Password — BETCLINIC 🐶🐱",
    html: `
    <div style="font-family: 'Poppins', sans-serif; background-color: #f2f8ff; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">

        <div style="background-color: #709775; color: #fff; text-align: center; padding: 20px;">
          <h2 style="margin: 0; font-size: 22px;">🔐 Password Reset Request</h2>
          <p style="margin: 5px 0; font-size: 14px;">BETCLINIC Veterinary Services</p>
        </div>

        <div style="padding: 25px; text-align: center;">
          <p style="font-size: 16px; color: #333;">Hi there 👋</p>
          <p style="font-size: 15px; color: #555;">Your verification code to reset your password:</p>

          <div style="margin-top: 20px; font-size: 32px; font-weight: bold; color: #709775;">
            ${otpCode}
          </div>

          <p style="margin-top: 30px; font-size: 14px; color: #888;">
            If you didn’t request a password reset, you can safely ignore this email.
          </p>

          <p style="margin-top: 25px; font-size: 14px; color: #bfd8bd; font-weight: 600;">
            🐾 BETCLINIC — Caring for Your Pets, Always.
          </p>
        </div>
      </div>
    </div>
    `,
  });

  console.log("Message sent:", info.messageId);
}
