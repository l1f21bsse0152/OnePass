
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,

    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Verify email transporter configuration
export const verifyEmailTransporter = async () => {
    try {
        await transporter.verify();
        console.log("Email service connected successfully.");
        return true;
    } catch (error) {
        console.error("Email service connection failed:", error.message);
        return false;
    }
};

// Send registration OTP
export const sendRegistrationOTP = async (email, otp) => {
    try {
        const info = await transporter.sendMail({
            from: `"OnePass" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "OnePass - Email Verification OTP",

            html: `
                <div style="font-family: Arial, sans-serif; padding: 25px;">
                    <h2>Welcome to OnePass!</h2>
                    <p>Use the following OTP to verify your email address:</p>

                    <h1 style="letter-spacing: 8px; color: #2563eb;">
                        ${otp}
                    </h1>

                    <p>This OTP is valid for 10 minutes.</p>
                    <p>If you did not request this verification,
                    please ignore this email.</p>

                    <br/>
                    <p>Regards,<br/>OnePass Team</p>
                </div>
            `,
        });

        console.log("Registration OTP email sent:", info.messageId);

        return {
            success: true,
            messageId: info.messageId,
        };

    } catch (error) {
        console.error("Registration OTP email failed:", error.message);
        throw new Error("Failed to send registration OTP email.");
    }
};

// Send password reset OTP
export const sendPasswordResetOTP = async (email, otp) => {
    try {
        const info = await transporter.sendMail({
            from: `"OnePass" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "OnePass - Password Reset OTP",

            html: `
                <div style="font-family: Arial, sans-serif; padding: 25px;">
                    <h2>Password Reset Request</h2>

                    <p>We received a request to reset your OnePass password.</p>

                    <p>Use the following OTP to verify your request:</p>

                    <h1 style="letter-spacing: 8px; color: #2563eb;">
                        ${otp}
                    </h1>

                    <p>This OTP is valid for 10 minutes.</p>

                    <p>If you did not request a password reset,
                    please ignore this email.</p>

                    <br/>
                    <p>Regards,<br/>OnePass Team</p>
                </div>
            `,
        });

        console.log("Password reset OTP email sent:", info.messageId);

        return {
            success: true,
            messageId: info.messageId,
        };

    } catch (error) {
        console.error("Password reset email failed:", error.message);
        throw new Error("Failed to send password reset OTP email.");
    }
};
