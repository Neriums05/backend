// Simple email sending utility using nodemailer.
// We wrap it in a try/catch so if email fails, the app doesn't crash.

const nodemailer = require('nodemailer');

// Set up the email transporter (we use Gmail here)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS // This should be a Gmail App Password, not your real password
  }
});

async function sendEmail(to, subject, htmlBody) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html: htmlBody
    });
    console.log('Email sent to', to);
  } catch (err) {
    // Just log it - don't crash the app if email fails
    console.error('Email failed:', err.message);
  }
}

module.exports = { sendEmail };
