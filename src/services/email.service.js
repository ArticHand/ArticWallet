const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  /**
   * Send password reset email
   * @param {string} email - Recipient email
   * @param {string} resetLink - Password reset link
   */
  async sendPasswordResetEmail(email, resetLink) {
    try {
      await this.transporter.sendMail({
        from: '"ArticWallet" <noreply@articwallet.com>',
        to: email,
        subject: 'Password Reset Request',
        html: `
          <h1>Password Reset</h1>
          <p>You have requested a password reset for your ArticWallet account.</p>
          <p>Click the link below to reset your password (expires in 1 hour):</p>
          <a href="${resetLink}">Reset Password</a>
          <p>If you did not request this reset, please ignore this email.</p>
        `
      });

      logger.info('Password reset email sent', { email });
    } catch (error) {
      logger.error('Failed to send password reset email', { 
        email, 
        error: error.message 
      });
      throw error;
    }
  }
}

module.exports = new EmailService();
