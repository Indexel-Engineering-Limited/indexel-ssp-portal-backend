const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || 587),
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});

async function sendPasswordResetEmail({ email, name, resetUrl }) {
  await transporter.sendMail({
    from: `"SSP Portal" <${process.env.MAIL_USER}>`,
    to: email,
    subject: "Reset Your Password",
    text: `
Hello ${name || "User"},

We received a request to reset your password.

Reset your password here:
${resetUrl}

This link will expire in 15 minutes.

If you did not request this password reset, you can safely ignore this email.

Regards,
SSP Portal
`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2>Password Reset</h2>

        <p>Hello ${name || "User"},</p>

        <p>We received a request to reset your password.</p>

        <p>
          <a href="${resetUrl}"
             style="
               display:inline-block;
               padding:12px 20px;
               background:#2d55a0;
               color:white;
               text-decoration:none;
               border-radius:6px;
             ">
            Reset Password
          </a>
        </p>

        <p>This link will expire in 15 minutes.</p>

        <p>If you did not request this password reset, you can safely ignore this email.</p>

        <p>Regards,<br>SSP Portal</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail };