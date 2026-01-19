import mongoose from 'mongoose';
import Business from '../models/Business.js';
import Outlet from '../models/Outlet.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import bcrypt from 'bcryptjs';
import { generateBusinessId } from '../utils/generateId.js';

export const createBusiness = async (req, res) => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const {
			firstName,
			lastName,
			username,
			email,
			password,
			businessName,
			phone,
			address,
		} = req.body;

		/* ---------------- VALIDATION ---------------- */
		if (!firstName || !lastName) {
			return res.status(400).json({
				message: 'First name and last name are required',
			});
		}

		if (!email) {
			return res.status(400).json({
				message: 'Email is required',
			});
		}

		/* ---------------- CHECK EXISTING USER ---------------- */
		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res.status(400).json({
				message: 'Email already in use',
			});
		}

		/* ---------------- PASSWORD ---------------- */
		const rawPassword = password || generateTemporaryPassword();
		const hashedPassword = await bcrypt.hash(rawPassword, 12);

		/* ---------------- USERNAME ---------------- */
		const generatedUsername =
			username || `${firstName.toLowerCase()}${lastName.toLowerCase()}`;

		/* ---------------- CREATE USER ---------------- */
		const user = await User.create(
			[
				{
					profile: {
						firstName,
						lastName,
						address,
						phone,
					},
					username: generatedUsername,
					password: hashedPassword,
					role: 'manager',
					department: 'business',
					createdBy: req.user._id,
				},
			],
			{ session },
		);

		/* ---------------- CREATE BUSINESS ---------------- */
		const business = await Business.create(
			[
				{
					name: businessName,
					phone,
					address,
					businessId: generateBusinessId(),
					managerId: user[0]._id,
					createdBy: req.user._id,
					owner: req.user._id,
				},
			],
			{ session },
		);

		/* ---------------- LINK USER TO BUSINESS ---------------- */
		user[0].businessId = business[0]._id;
		await user[0].save({ session });

		await session.commitTransaction();
		session.endSession();

		return res.status(201).json({
			success: true,
			message: 'Business created successfully',
			business: business[0],
			user: {
				_id: user[0]._id,
				email: user[0].email,
				username: user[0].username,
				role: user[0].role,
			},
			// Optional: return rawPassword if auto-generated (email it instead)
		});
	} catch (error) {
		await session.abortTransaction();
		session.endSession();

		console.error('Create business error:', error);

		return res.status(500).json({
			success: false,
			message: 'Failed to create business',
			error: error.message,
		});
	}
};

export const getBusinesses = async (req, res) => {
	try {
		const filter = {};

		// Managers can only see their Business
		if (req.user.role === 'manager' && req.user.businessId) {
			filter._id = req.user.BusinessId;
		}

		const businesses = await Business.find(filter)
			.populate('createdBy', 'username email phone')
			.populate('owner', 'username email phone')
			.populate('managerId', 'username email phone')
			.populate('managers', 'username email phone')
			.sort({ createdAt: -1 });

		res.json({
			success: true,
			count: businesses.length,
			businesses,
		});
	} catch (error) {
		console.error('Get Businesses Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch Businesses',
			error: error.message,
		});
	}
};
export const getBusinessesAndOutlets = async (req, res) => {
	try {
		const filter = {};

		// Managers can only see their Business
		if (req.user.role === 'manager' && req.user.businessId) {
			filter._id = req.user.BusinessId;
		}
		const businesses = await Business.find(filter)
			.populate('managers', 'username email phone')
			.sort({ createdAt: -1 });
		// Build clean response
		const formatted = await Promise.all(
			businesses.map(async (business) => {
				const outlets = await Outlet.find({ businessId: business._id }).select(
					'_id name address outletId',
				);

				return {
					_id: business._id,
					businessId: business.businessId,
					name: business.name,
					address: business.address,
					phone: business.phone,
					managers: business.managers, // already populated (username, email, phone)
					outlets,
				};
			}),
		);

		return res.status(200).json({
			success: true,
			total: formatted.length,
			data: formatted,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: 'Server error',
			error: error.message,
		});
	}
};

export const getBusinessById = async (req, res) => {
	try {
		const business = await Business.findById(req.params.id)
			.populate('createdBy', 'username email')
			.populate('owner', 'username email')
			.populate('managers', 'username email')
			.populate('managerId', 'username email');
		if (!business) {
			return res.status(404).json({
				success: false,
				message: 'Business not found',
			});
		}

		const outlets = await Outlet.find({ businessId: business._id }).select(
			'_id businessId name address phone',
		);
		const products = await Product.find({businessId: business._id}).select(
			'_id businessId name description price',
		)
		const invoices = await Invoice.find({ businessId: business._id }).select(
			'_id businessId name address phone',
		);
		const payments = await Payment.find({ businessId: business._id }).select(
			'_id businessId name address phone',
		);

		const stats = {
			totalOutlets: outlets.length,
			totalProducts: products.length,
			totalInvoices: invoices.length,
			totalPayments: payments.length,
		}

		res.json({
			success: true,
			business,
			outlets,
			products,
			invoices,
			stats
		});
	} catch (error) {
		console.error('Get Business By ID Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch Business',
			error: error.message,
		});
	}
};

export const updateBusiness = async (req, res) => {
	try {
		console.log('Update Business Req Body:', req.body);
		const updated = await Business.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
		});
		res.json({
			success: true,
			business: updated,
		});
	} catch (error) {
		console.error('Get Updating business By ID Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to update Business',
			error: error.message,
		});
	}
};

export const deleteBusiness = async (req, res) => {
	try {
		await Business.findByIdAndDelete(req.params.id);
		res.json({ success: true, message: 'Business deleted successfully' });
	} catch (error) {
		console.error('Get Business By ID Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch Business',
			error: error.message,
		});
	}
};
export const getAllBusinessAndOutlets = async (req, res) => {
	try {
		const filter = {};
		// Managers can only see their Business
		if (req.user.role === 'manager' && req.user.businessId) {
			filter._id = req.user.BusinessId;
		}
		const businesses = await Business.find(filter).select(
			'_id businessId name address phone',
		);
		const outletFilter =
			req.user.role === 'manager' ? { businessId: req.user.businessId } : {};

		const outlets = await Outlet.find(outletFilter).select(
			'_id businessId name address phone',
		);
		res.json({
			businesses,
			outlets,
			success: true,
			message: 'Business and outlets fetched successfully',
		});
	} catch (error) {
		console.error('Get Business By ID Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch Business',
			error: error.message,
		});
	}
};
