import { sendEmail } from '../config/email.js';

export const sendPasswordResetEmail = async (email, resetToken) => {
	const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

	const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #007bff; color: white; padding: 20px; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; }
                .button { 
                    display: inline-block; 
                    background: #007bff; 
                    color: white; 
                    padding: 12px 24px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    margin: 20px 0;
                }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Mikiya International Limited</h1>
                </div>
                <div class="content">
                    <h2>Password Reset Request</h2>
                    <p>You requested to reset your password. Click the button below to proceed:</p>
                    <a href="${resetUrl}" class="button">Reset Password</a>
                    <p>This link will expire in 10 minutes.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} Mikiya International Limited. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

	return await sendEmail(email, 'Password Reset Request', html);
};

export const sendAccountSuspendedEmail = async (email, reason) => {
	const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Account Suspension Notice</h1>
                </div>
                <div class="content">
                    <h2>Your Account Has Been Suspended</h2>
                    <p>Your account access has been suspended for the following reason:</p>
                    <p><strong>Reason:</strong> ${reason}</p>
                    <p>Please contact the system administrator if you believe this is a mistake.</p>
                </div>
                <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} Mikiya International Limited. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

	return await sendEmail(email, 'Account Suspension Notice', html);
};

export const sendWelcomeEmail = async (email, username, temporaryPassword) => {
	const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #28a745; color: white; padding: 20px; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; }
                .alert { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Mikiya International Limited</h1>
                </div>
                <div class="content">
                    <h2>Hello ${username}!</h2>
                    <p>Your account has been created successfully.</p>
                    <div class="alert">
                        <p><strong>Your temporary password:</strong> ${temporaryPassword}</p>
                        <p>Please change your password after first login.</p>
                    </div>
                    <p>You can login at: <a href="${
											process.env.FRONTEND_URL
										}/login">${process.env.FRONTEND_URL}/login</a></p>
                </div>
                <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} Mikiya International Limited. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

	return await sendEmail(email, 'Welcome to Mikiya International Limited', html);
};
