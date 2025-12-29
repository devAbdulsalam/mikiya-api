import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import PasswordReset from '../models/PasswordReset.js';
import { auth, isAdmin } from '../middlewares/auth.js';
import {
	validate,
	registerValidation,
	loginValidation,
	changePasswordValidation,
	forgotPasswordValidation,
	resetPasswordValidation,
} from '../middlewares/validation.js';
import {
	sendPasswordResetEmail,
	sendAccountSuspendedEmail,
	sendWelcomeEmail,
} from '../utils/sendEmail.js';
import {
	generateTemporaryPassword,
	validatePasswordStrength,
} from '../utils/helpers.js';
import { generateUserId } from '../utils/generateId.js';
import { hash, verifyHash } from '../utils/passwordUtils.js';
import {
	createAccessToken,
	createRefreshToken,
} from '../utils/createTokens.js';

const router = express.Router();

// Register (Admin only)
router.post(
	'/register',
	auth,
	isAdmin,
	validate(registerValidation),
	async (req, res) => {
		try {
			const { username, email, password, role, outletId } = req.body;

			// Check if user exists
			const existingUser = await User.findOne({
				$or: [{ email }, { username }],
			});

			if (existingUser) {
				return res.status(400).json({
					success: false,
					message: 'User already exists',
				});
			}

			// Generate user ID
			const userId = generateUserId();

			// Create user
			const user = new User({
				userId,
				username,
				email,
				password: password || generateTemporaryPassword(),
				role: role || 'staff',
				outletId,
				createdBy: req.user._id,
			});

			await user.save();

			// Send welcome email if email is provided
			if (email) {
				await sendWelcomeEmail(email, username, password || user.password);
			}

			// Remove password from response
			user.password = undefined;

			res.status(201).json({
				success: true,
				message: 'User registered successfully',
				user,
			});
		} catch (error) {
			console.error('Registration Error:', error);
			res.status(500).json({
				success: false,
				message: 'Registration failed',
				error: error.message,
			});
		}
	}
);

// Login
router.post('/login', validate(loginValidation), async (req, res) => {
	try {
		const { email, password } = req.body;

		// Find user with password
		const user = await User.findOne({ email }).select(
			'+password +loginAttempts +lockUntil'
		);

		if (!user) {
			return res.status(401).json({
				success: false,
				message: 'Invalid credentials',
			});
		}

		// Check if account is suspended
		if (user.isSuspended) {
			return res.status(403).json({
				success: false,
				message: 'Account is suspended',
				suspensionReason: user.suspensionReason,
			});
		}
		// const newPassword = await hash(password);
		// // console.log('newPassword', newPassword);
		// user.password = newPassword;
		// user.lastPasswordChange = new Date();
		// await user.save();

		// Check if account is locked
		if (user.isLocked()) {
			return res.status(423).json({
				success: false,
				message: 'Account is locked. Try again later.',
				lockUntil: user.lockUntil,
			});
		}

		// console.log('password', user.password);

		// Verify password
		const isPasswordValid = await await bcrypt.compare(password, user.password);
		// const isPasswordValid = await await bcrypt.compare(password, newPassword);

		if (!isPasswordValid) {
			// Increment login attempts
			await user.incrementLoginAttempts();

			return res.status(401).json({
				success: false,
				message: 'Invalid credentials',
			});
		}

		// Reset login attempts on successful login
		await user.resetLoginAttempts();

		// Update last login
		user.lastLogin = new Date();
		await user.save();

		// Generate token
		const accessToken = await createAccessToken(user);
		// Generate token
		const refreshToken = await createRefreshToken(user);

		// Remove sensitive data
		user.password = undefined;
		user.loginAttempts = undefined;
		user.lockUntil = undefined;

		const options = {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
		};

		return res
			.status(200)
			.cookie('accessToken', accessToken, options) // set the access token in the cookie
			.cookie('refreshToken', refreshToken, options)
			.json({
				accessToken,
				refreshToken,
				success: true,
				message: 'Login successful',
				user: {
					id: user._id,
					userId: user.userId,
					username: user.username,
					email: user.email,
					role: user.role,
					outletId: user.outletId,
					profile: user.profile,
					settings: user.settings,
				},
			});
	} catch (error) {
		console.error('Login Error:', error);
		res.status(500).json({
			success: false,
			message: 'Login failed',
			error: error.message,
		});
	}
});

// Change Password
router.post(
	'/change-password',
	auth,
	validate(changePasswordValidation),
	async (req, res) => {
		try {
			const { currentPassword, newPassword } = req.body;
			const user = await User.findById(req.user.id).select('+password');

			// Verify current password
			const isPasswordValid = await user.comparePassword(currentPassword);
			if (!isPasswordValid) {
				return res.status(400).json({
					success: false,
					message: 'Current password is incorrect',
				});
			}

			// Check password strength
			const passwordStrength = validatePasswordStrength(newPassword);
			if (!passwordStrength.isValid) {
				return res.status(400).json({
					success: false,
					message: 'Password is too weak',
					strength: passwordStrength,
				});
			}

			// Update password
			user.password = newPassword;
			await user.save();

			res.json({
				success: true,
				message: 'Password changed successfully',
			});
		} catch (error) {
			console.error('Change Password Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to change password',
				error: error.message,
			});
		}
	}
);

// Forgot Password
router.post(
	'/forgot-password',
	validate(forgotPasswordValidation),
	async (req, res) => {
		try {
			const { email } = req.body;

			const user = await User.findOne({ email });
			if (!user) {
				// Don't reveal that user doesn't exist
				return res.json({
					success: true,
					message:
						'If an account exists with this email, you will receive a reset link',
				});
			}

			// Generate reset token
			const resetToken = crypto.randomBytes(32).toString('hex');
			const hashedToken = crypto
				.createHash('sha256')
				.update(resetToken)
				.digest('hex');

			// Save reset token
			await PasswordReset.create({
				userId: user._id,
				token: hashedToken,
				expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
			});

			// Send reset email
			await sendPasswordResetEmail(email, resetToken);

			res.json({
				success: true,
				message: 'Password reset link sent to email',
			});
		} catch (error) {
			console.error('Forgot Password Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to process request',
				error: error.message,
			});
		}
	}
);

// Reset Password
router.post(
	'/reset-password',
	validate(resetPasswordValidation),
	async (req, res) => {
		try {
			const { token, password } = req.body;

			// Hash the token
			const hashedToken = crypto
				.createHash('sha256')
				.update(token)
				.digest('hex');

			// Find valid reset token
			const passwordReset = await PasswordReset.findOne({
				token: hashedToken,
				used: false,
				expiresAt: { $gt: new Date() },
			});

			if (!passwordReset) {
				return res.status(400).json({
					success: false,
					message: 'Invalid or expired reset token',
				});
			}

			// Find user
			const user = await User.findById(passwordReset.userId);
			if (!user) {
				return res.status(404).json({
					success: false,
					message: 'User not found',
				});
			}

			// Check password strength
			const passwordStrength = validatePasswordStrength(password);
			if (!passwordStrength.isValid) {
				return res.status(400).json({
					success: false,
					message: 'Password is too weak',
					strength: passwordStrength,
				});
			}

			// Update password
			user.password = password;
			user.passwordResetToken = undefined;
			user.passwordResetExpires = undefined;
			await user.save();

			// Mark token as used
			passwordReset.used = true;
			await passwordReset.save();

			res.json({
				success: true,
				message: 'Password reset successful',
			});
		} catch (error) {
			console.error('Reset Password Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to reset password',
				error: error.message,
			});
		}
	}
);

// Get current user profile
router.get('/profile', auth, async (req, res) => {
	try {
		const user = await User.findById(req.user.id)
			.populate('outletId', 'name outletId type')
			.select('-password -loginAttempts -lockUntil');

		if (!user) {
			return res.status(404).json({
				success: false,
				message: 'User not found',
			});
		}

		res.json({
			success: true,
			user,
		});
	} catch (error) {
		console.error('Get Profile Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch profile',
			error: error.message,
		});
	}
});

router.post('/refresh-token', auth, async (req, res, next) => {
	try {
		const { refreshToken } = req.body;
		if (!refreshToken) throw { message: 'refresh Token error' };
		const decode = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
		console.log('decode', decode);
		const user = await User.findById(decode.id);
		console.log('user', user);
		if (!user) {
			return res.status(404).send({
				success: false,
				message: 'User not found',
			});
		}

		// Generate new tokens
		const token = createAccessToken(decode);
		const refToken = createRefreshToken(decode);

		res.status(200).send({
			token,
			refreshToken: refToken,
		});
	} catch (error) {
		next(error);
	}
});
// Update user profile
router.put('/profile', auth, async (req, res) => {
	try {
		const { firstName, lastName, phone, avatar } = req.body;
		const updates = {};

		if (firstName) updates['profile.firstName'] = firstName;
		if (lastName) updates['profile.lastName'] = lastName;
		if (phone) updates['profile.phone'] = phone;
		if (avatar) updates['profile.avatar'] = avatar;

		const user = await User.findByIdAndUpdate(
			req.user.id,
			{ $set: updates },
			{ new: true, runValidators: true }
		).select('-password');

		res.json({
			success: true,
			message: 'Profile updated successfully',
			user,
		});
	} catch (error) {
		console.error('Update Profile Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to update profile',
			error: error.message,
		});
	}
});

// Update user settings
router.put('/settings', auth, async (req, res) => {
	try {
		const { emailNotifications, smsNotifications, language, theme } = req.body;
		const updates = {};

		if (emailNotifications !== undefined)
			updates['settings.emailNotifications'] = emailNotifications;
		if (smsNotifications !== undefined)
			updates['settings.smsNotifications'] = smsNotifications;
		if (language) updates['settings.language'] = language;
		if (theme) updates['settings.theme'] = theme;

		const user = await User.findByIdAndUpdate(
			req.user.id,
			{ $set: updates },
			{ new: true, runValidators: true }
		).select('-password');

		res.json({
			success: true,
			message: 'Settings updated successfully',
			user,
		});
	} catch (error) {
		console.error('Update Settings Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to update settings',
			error: error.message,
		});
	}
});

// Get all users (Admin only)
router.get('/users', auth, isAdmin, async (req, res) => {
	try {
		const { role, outletId, isActive, isSuspended, search } = req.query;
		const filter = {};

		if (role) filter.role = role;
		if (outletId) filter.outletId = outletId;
		if (isActive !== undefined) filter.isActive = isActive === 'true';
		if (isSuspended !== undefined) filter.isSuspended = isSuspended === 'true';

		if (search) {
			filter.$or = [
				{ username: { $regex: search, $options: 'i' } },
				{ email: { $regex: search, $options: 'i' } },
				{ 'profile.firstName': { $regex: search, $options: 'i' } },
				{ 'profile.lastName': { $regex: search, $options: 'i' } },
			];
		}

		const users = await User.find(filter)
			.populate('outletId', 'name outletId')
			.populate('createdBy', 'username')
			.populate('suspendedBy', 'username')
			.select('-password -loginAttempts -lockUntil')
			.sort({ createdAt: -1 });

		res.json({
			success: true,
			count: users.length,
			users,
		});
	} catch (error) {
		console.error('Get Users Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch users',
			error: error.message,
		});
	}
});

// Suspend user (Admin only)
router.post('/users/:id/suspend', auth, isAdmin, async (req, res) => {
	try {
		const { reason } = req.body;
		const userId = req.params.id;

		// Cannot suspend yourself
		if (userId === req.user.id) {
			return res.status(400).json({
				success: false,
				message: 'You cannot suspend your own account',
			});
		}

		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({
				success: false,
				message: 'User not found',
			});
		}

		// Update user
		user.isSuspended = true;
		user.suspensionReason = reason;
		user.suspendedBy = req.user.id;
		user.suspensionDate = new Date();
		await user.save();

		// Send suspension email
		if (user.email) {
			await sendAccountSuspendedEmail(user.email, reason);
		}

		res.json({
			success: true,
			message: 'User suspended successfully',
			user: {
				id: user._id,
				username: user.username,
				email: user.email,
				isSuspended: user.isSuspended,
				suspensionReason: user.suspensionReason,
				suspensionDate: user.suspensionDate,
			},
		});
	} catch (error) {
		console.error('Suspend User Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to suspend user',
			error: error.message,
		});
	}
});

// Activate user (Admin only)
router.post('/users/:id/activate', auth, isAdmin, async (req, res) => {
	try {
		const user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({
				success: false,
				message: 'User not found',
			});
		}

		// Update user
		user.isSuspended = false;
		user.suspensionReason = undefined;
		user.suspendedBy = undefined;
		user.suspensionDate = undefined;
		await user.save();

		res.json({
			success: true,
			message: 'User activated successfully',
			user: {
				id: user._id,
				username: user.username,
				email: user.email,
				isSuspended: user.isSuspended,
			},
		});
	} catch (error) {
		console.error('Activate User Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to activate user',
			error: error.message,
		});
	}
});

// Reset user password (Admin only)
router.post('/users/:id/reset-password', auth, isAdmin, async (req, res) => {
	try {
		const user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({
				success: false,
				message: 'User not found',
			});
		}

		// Generate temporary password
		const temporaryPassword = generateTemporaryPassword(10);

		// Update password
		user.password = temporaryPassword;
		await user.save();

		// Send email with temporary password
		if (user.email) {
			await sendWelcomeEmail(user.email, user.username, temporaryPassword);
		}

		res.json({
			success: true,
			message: 'Password reset successful',
			temporaryPassword, // Only for admin to see, in production you might not want to send this
		});
	} catch (error) {
		console.error('Reset User Password Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to reset password',
			error: error.message,
		});
	}
});

// Delete user (Admin only)
router.delete('/users/:id', auth, isAdmin, async (req, res) => {
	try {
		const userId = req.params.id;

		// Cannot delete yourself
		if (userId === req.user.id) {
			return res.status(400).json({
				success: false,
				message: 'You cannot delete your own account',
			});
		}

		const user = await User.findByIdAndDelete(userId);
		if (!user) {
			return res.status(404).json({
				success: false,
				message: 'User not found',
			});
		}

		res.json({
			success: true,
			message: 'User deleted successfully',
		});
	} catch (error) {
		console.error('Delete User Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to delete user',
			error: error.message,
		});
	}
});

// Verify token
router.get('/verify', auth, async (req, res) => {
	try {
		const user = await User.findById(req.user.id)
			.populate('outletId', 'name outletId type')
			.select('-password -loginAttempts -lockUntil');

		res.json({
			success: true,
			user,
		});
	} catch (error) {
		console.error('Verify Token Error:', error);
		res.status(500).json({
			success: false,
			message: 'Token verification failed',
			error: error.message,
		});
	}
});

// Logout
router.post('/logout', auth, async (req, res) => {
	try {
		// In a real application, you might want to blacklist the token
		res.json({
			success: true,
			message: 'Logged out successfully',
		});
	} catch (error) {
		console.error('Logout Error:', error);
		res.status(500).json({
			success: false,
			message: 'Logout failed',
			error: error.message,
		});
	}
});

export default router;
