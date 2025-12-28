import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
	host: process.env.EMAIL_HOST,
	port: process.env.EMAIL_PORT,
	secure: false,
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS,
	},
	tls: {
		rejectUnauthorized: false,
	},
});

export const sendEmail = async (to, subject, html) => {
	try {
		const mailOptions = {
			from: `"Business Management System" <${process.env.EMAIL_FROM}>`,
			to,
			subject,
			html,
		};

		const info = await transporter.sendMail(mailOptions);
		console.log(`📧 Email sent: ${info.messageId}`);
		return true;
	} catch (error) {
		console.error('❌ Email sending error:', error);
		return false;
	}
};

export default transporter;
