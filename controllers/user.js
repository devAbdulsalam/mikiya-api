import express from 'express';
import User from '../models/User.js';
import { auth, isAdmin } from '../middlewares/auth.js';
import {
	sendWelcomeEmail,
	sendAccountSuspendedEmail,
} from '../utils/sendEmail.js';
import {
	generateTemporaryPassword,
	validatePasswordStrength,
} from '../utils/helpers.js';
import { generateUserId } from '../utils/generateId.js';
import Business from '../models/Business.js';
import Outlet from '../models/Outlet.js';

export const createManager = async ({
	username,
	email,
	password,
	businessId,
	outletId,
}) => {
	if (!username || !email || !password) {
		return res.status(400).json({ message: 'All fields are required' });
	}

	if (await User.findOne({ email })) {
		return res.status(400).json({ message: 'Email already in use' });
	}
	const user = await User.create({
		username,
		email,
		password,
		role: 'manager',
	});

	if (businessId) user.assignedBusinesses.push(businessId);
	if (outletId) user.assignedOutlets.push(outletId);

	await user.save();
	return user;
};

// controllers/userController.js
export const suspendUser = async (req, res) => {
	const user = await User.findById(req.params.id);
	user.status = 'suspended';
	await user.save();
	res.json({ message: 'User suspended' });
};

export const assignManager = async (req, res) => {
	const { userId, businessId, outletId } = req.body;

	const user = await User.findById(userId);
	if (!user) return res.status(404).json({ message: 'User not found' });

	user.role = 'manager';
	if (businessId) {
		user.assignedBusinesses.push(businessId);
		await Business.findByIdAndUpdate(businessId, {
			$addToSet: { managers: userId },
		});
	}
	if (outletId) {
		user.assignedOutlets.push(outletId);
		await Outlet.findByIdAndUpdate(outletId, {
			$addToSet: { managers: userId },
		});
	}
	await user.save();
	res.json({ message: 'Manager assigned', user });
};
export const getUsers = async (req, res) => {
	try {
		const {
			role,
			businessId,
			outletId,
			isActive,
			isSuspended,
			search,
			page = 1,
			limit = 20,
		} = req.query;

		const filter = {};
		const pageNum = parseInt(page);
		const limitNum = parseInt(limit);
		const skip = (pageNum - 1) * limitNum;

		if (role) filter.role = role;
		if (outletId) filter.outletId = outletId;
		if (businessId) filter.businessId = businessId;
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

		const [users, total] = await Promise.all([
			User.find(filter)
				.populate('outletId', 'name outletId')
				.populate('createdBy', 'username')
				.populate('suspendedBy', 'username')
				.select('-password -loginAttempts -lockUntil')
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limitNum),
			User.countDocuments(filter),
		]);

		res.json({
			success: true,
			count: users.length,
			total,
			pages: Math.ceil(total / limitNum),
			currentPage: pageNum,
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
};

export const createUser = async (req, res) => {
	try {
		const { username, email, role, outletId, profile } = req.body;

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

		// Generate temporary password
		const temporaryPassword = generateTemporaryPassword(10);

		// Create user
		const user = new User({
			username,
			email,
			password: temporaryPassword,
			role: role || 'staff',
			outletId,
			profile,
			createdBy: req.user._id,
		});

		await user.save();

		// Send welcome email
		if (email) {
			await sendWelcomeEmail(email, username, temporaryPassword);
		}

		// Remove password from response
		const userResponse = await User.findById(user._id)
			.select('-password -loginAttempts -lockUntil')
			.populate('outletId', 'name outletId');

		res.status(201).json({
			success: true,
			message: 'User created successfully',
			user: userResponse,
			temporaryPassword, // Only admin can see this
		});
	} catch (error) {
		console.error('Create User Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to create user',
			error: error.message,
		});
	}
};

export const updateUser = async (req, res) => {
	try {
		const { role, outletId, isActive, profile, settings, businessId } =
			req.body;
		const userId = req.params.id;

		// Cannot update yourself
		// if (userId === req.user.id) {
		// 	return res.status(400).json({
		// 		success: false,
		// 		message: 'You cannot update your own account via this endpoint',
		// 	});
		// }

		const updates = {};
		if (role) updates.role = role;
		if (outletId !== undefined) updates.outletId = outletId;
		if (businessId !== undefined) updates.businessId = businessId;
		if (isActive !== undefined) updates.isActive = isActive;
		if (profile) updates.profile = profile;
		if (settings) updates.settings = settings;

		const user = await User.findByIdAndUpdate(
			userId,
			{ $set: updates },
			{ new: true, runValidators: true }
		)
			.select('-password -loginAttempts -lockUntil')
			.populate('outletId', 'name outletId');

		if (!user) {
			return res.status(404).json({
				success: false,
				message: 'User not found',
			});
		}

		res.json({
			success: true,
			message: 'User updated successfully',
			user,
		});
	} catch (error) {
		console.error('Update User Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to update user',
			error: error.message,
		});
	}
};
export const getUserStats = async (req, res) => {
	try {
		const stats = await User.aggregate([
			{
				$group: {
					_id: '$role',
					count: { $sum: 1 },
					active: {
						$sum: {
							$cond: [{ $eq: ['$isActive', true] }, 1, 0],
						},
					},
					suspended: {
						$sum: {
							$cond: [{ $eq: ['$isSuspended', true] }, 1, 0],
						},
					},
				},
			},
		]);

		const total = await User.countDocuments();
		const active = await User.countDocuments({
			isActive: true,
			isSuspended: false,
		});
		const suspended = await User.countDocuments({ isSuspended: true });
		const recent = await User.countDocuments({
			createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
		});

		res.json({
			success: true,
			stats: {
				total,
				active,
				suspended,
				recent,
				byRole: stats,
			},
		});
	} catch (error) {
		console.error('Get User Stats Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch user statistics',
			error: error.message,
		});
	}
};

export const getUser = async (req, res) => {
	try {
		const userId = req.params.id;

		const user = await User.findById(userId)
			.select('-password -loginAttempts -lockUntil')
			.populate('outletId', 'name outletId');

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
		console.error('Get User Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch user',
			error: error.message,
		});
	}
};
