import express from 'express';
import mongoose from 'mongoose';
import Fund from '../../models/Fund.js';
import Foundation from '../../models/Foundation.js';
import Donation from '../../models/Donation.js';
import FoundationExpense from '../../models/FoundationExpense.js';
import { auth, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validation.js';
import {
	fundValidation,
	updateFundValidation,
} from '../../middlewares/foundationValidation.js';

const router = express.Router();

// GET /api/foundation/funds - Get all funds with filters and pagination
router.get('/', auth, async (req, res) => {
	try {
		const {
			foundationId,
			status,
			type,
			category,
			search,
			page = 1,
			limit = 20,
			sortBy = 'createdAt',
			order = 'desc',
		} = req.query;

		if (!foundationId) {
			return res.status(400).json({
				success: false,
				message: 'Foundation ID is required',
			});
		}

		const filter = { foundationId };
		const pageNum = parseInt(page);
		const limitNum = parseInt(limit);
		const skip = (pageNum - 1) * limitNum;
		const sortOrder = order === 'asc' ? 1 : -1;

		if (status) filter.status = status;
		if (type) filter.type = type;
		if (category) filter.category = category;

		if (search) {
			filter.$or = [
				{ name: { $regex: search, $options: 'i' } },
				{ description: { $regex: search, $options: 'i' } },
				{ purpose: { $regex: search, $options: 'i' } },
				{ fundId: { $regex: search, $options: 'i' } },
			];
		}

		// Check if fund is active based on dates and balance
		if (status === 'active') {
			filter.isActive = true;
			filter.currentBalance = { $gt: 0 };
			filter.$or = [{ endDate: { $gte: new Date() } }, { endDate: null }];
		} else if (status === 'inactive') {
			filter.isActive = false;
		} else if (status === 'depleted') {
			filter.currentBalance = { $lte: 0 };
		} else if (status === 'expired') {
			filter.endDate = { $lt: new Date() };
		}

		const [funds, total] = await Promise.all([
			Fund.find(filter)
				.populate('foundationId', 'name registrationNumber')
				.populate(
					'createdBy',
					'username email profile.firstName profile.lastName'
				)
				.populate('approvedBy', 'username email')
				.sort({ [sortBy]: sortOrder })
				.skip(skip)
				.limit(limitNum),
			Fund.countDocuments(filter),
		]);

		// Calculate summary statistics
		const summary = {
			totalFunds: total,
			totalBalance: funds.reduce((sum, fund) => sum + fund.currentBalance, 0),
			totalAllocated: funds.reduce(
				(sum, fund) => sum + fund.allocatedAmount,
				0
			),
			totalCommitted: funds.reduce(
				(sum, fund) => sum + fund.committedAmount,
				0
			),
			totalAvailable: funds.reduce(
				(sum, fund) => sum + fund.availableBalance,
				0
			),
			totalTarget: funds.reduce((sum, fund) => sum + fund.targetAmount, 0),
		};

		const totalPages = Math.ceil(total / limitNum);
		const hasNextPage = pageNum < totalPages;
		const hasPrevPage = pageNum > 1;

		res.json({
			success: true,
			count: funds.length,
			total,
			pagination: {
				currentPage: pageNum,
				totalPages,
				hasNextPage,
				hasPrevPage,
				nextPage: hasNextPage ? pageNum + 1 : null,
				prevPage: hasPrevPage ? pageNum - 1 : null,
				limit: limitNum,
			},
			summary,
			funds: funds.map((fund) => ({
				id: fund._id,
				fundId: fund.fundId,
				name: fund.name,
				description: fund.description,
				purpose: fund.purpose,
				type: fund.type,
				category: fund.category,
				currency: fund.currency,
				targetAmount: fund.targetAmount,
				currentBalance: fund.currentBalance,
				allocatedAmount: fund.allocatedAmount,
				committedAmount: fund.committedAmount,
				availableBalance: fund.availableBalance,
				startDate: fund.startDate,
				endDate: fund.endDate,
				isActive: fund.isActive,
				isRestricted: fund.isRestricted,
				restrictions: fund.restrictions,
				performance: fund.performance,
				status: fund.status,
				targetAchievement: fund.targetAchievement,
				createdBy: fund.createdBy,
				approvedBy: fund.approvedBy,
				createdAt: fund.createdAt,
				updatedAt: fund.updatedAt,
			})),
		});
	} catch (error) {
		console.error('Get Funds Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch funds',
			error: error.message,
		});
	}
});

// GET /api/foundation/funds/:id - Get single fund with detailed information
router.get('/:id', auth, async (req, res) => {
	try {
		const { id } = req.params;

		let fund;
		if (mongoose.Types.ObjectId.isValid(id)) {
			fund = await Fund.findById(id)
				.populate('foundationId', 'name registrationNumber contact')
				.populate(
					'createdBy',
					'username email profile.firstName profile.lastName'
				)
				.populate('approvedBy', 'username email')
				.populate('updatedBy', 'username email');
		} else {
			fund = await Fund.findOne({ fundId: id })
				.populate('foundationId', 'name registrationNumber contact')
				.populate(
					'createdBy',
					'username email profile.firstName profile.lastName'
				)
				.populate('approvedBy', 'username email')
				.populate('updatedBy', 'username email');
		}

		if (!fund) {
			return res.status(404).json({
				success: false,
				message: 'Fund not found',
			});
		}

		// Get recent transactions for this fund
		const recentDonations = await Donation.find({ fundId: fund._id })
			.sort({ donationDate: -1 })
			.limit(10)
			.select('donationId donorName amount donationDate paymentMethod status');

		const recentExpenses = await FoundationExpense.find({ fundId: fund._id })
			.sort({ paymentDate: -1 })
			.limit(10)
			.select('expenseId description payeeName totalAmount paymentDate status');

		// Calculate utilization trend (last 6 months)
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

		const utilizationTrend = await FoundationExpense.aggregate([
			{
				$match: {
					fundId: fund._id,
					paymentDate: { $gte: sixMonthsAgo },
					status: 'paid',
				},
			},
			{
				$group: {
					_id: {
						year: { $year: '$paymentDate' },
						month: { $month: '$paymentDate' },
					},
					totalAmount: { $sum: '$totalAmount' },
					count: { $sum: 1 },
				},
			},
			{
				$sort: { '_id.year': 1, '_id.month': 1 },
			},
		]);

		res.json({
			success: true,
			fund: {
				id: fund._id,
				fundId: fund.fundId,
				name: fund.name,
				description: fund.description,
				purpose: fund.purpose,
				type: fund.type,
				category: fund.category,
				currency: fund.currency,
				targetAmount: fund.targetAmount,
				currentBalance: fund.currentBalance,
				allocatedAmount: fund.allocatedAmount,
				committedAmount: fund.committedAmount,
				availableBalance: fund.availableBalance,
				startDate: fund.startDate,
				endDate: fund.endDate,
				isActive: fund.isActive,
				isRestricted: fund.isRestricted,
				restrictions: fund.restrictions,
				allowedExpenseCategories: fund.allowedExpenseCategories,
				disallowedExpenseCategories: fund.disallowedExpenseCategories,
				fundingSources: fund.fundingSources,
				performance: fund.performance,
				budget: fund.budget,
				status: fund.status,
				targetAchievement: fund.targetAchievement,
				notes: fund.notes,
				tags: fund.tags,
				attachments: fund.attachments,
				foundation: fund.foundationId,
				createdBy: fund.createdBy,
				approvedBy: fund.approvedBy,
				updatedBy: fund.updatedBy,
				createdAt: fund.createdAt,
				updatedAt: fund.updatedAt,
			},
			recentActivity: {
				donations: recentDonations,
				expenses: recentExpenses,
			},
			utilizationTrend,
		});
	} catch (error) {
		console.error('Get Fund Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch fund',
			error: error.message,
		});
	}
});

// POST /api/foundation/funds - Create a new fund
router.post(
	'/',
	auth,
	authorize('admin', 'manager'),
	validate(fundValidation),
	async (req, res) => {
		try {
			const fundData = req.body;
			const userId = req.user.id;

			// Check if foundation exists
			const foundation = await Foundation.findById(fundData.foundationId);
			if (!foundation) {
				return res.status(404).json({
					success: false,
					message: 'Foundation not found',
				});
			}

			// Generate fund ID
			const timestamp = Date.now().toString().slice(-6);
			const random = Math.floor(Math.random() * 1000)
				.toString()
				.padStart(3, '0');
			fundData.fundId = `FUND-${timestamp}-${random}`;

			// Set createdBy
			fundData.createdBy = userId;

			// If user is manager, require approval
			if (req.user.role === 'manager') {
				fundData.approvalStatus = 'pending';
			} else if (req.user.role === 'admin') {
				fundData.approvalStatus = 'approved';
				fundData.approvedBy = userId;
				fundData.approvalDate = new Date();
			}

			// Calculate initial available balance
			fundData.availableBalance =
				fundData.currentBalance -
				(fundData.allocatedAmount || 0) -
				(fundData.committedAmount || 0);

			const fund = new Fund(fundData);
			await fund.save();

			// Update foundation statistics
			await Foundation.findByIdAndUpdate(fundData.foundationId, {
				$inc: { 'statistics.totalFunds': 1 },
			});

			const populatedFund = await Fund.findById(fund._id)
				.populate('foundationId', 'name')
				.populate('createdBy', 'username email');

			res.status(201).json({
				success: true,
				message: 'Fund created successfully',
				fund: populatedFund,
			});
		} catch (error) {
			console.error('Create Fund Error:', error);

			if (error.code === 11000) {
				return res.status(400).json({
					success: false,
					message: 'Fund ID already exists',
				});
			}

			if (error.name === 'ValidationError') {
				const errors = Object.values(error.errors).map((err) => ({
					field: err.path,
					message: err.message,
				}));

				return res.status(400).json({
					success: false,
					message: 'Validation failed',
					errors,
				});
			}

			res.status(500).json({
				success: false,
				message: 'Failed to create fund',
				error: error.message,
			});
		}
	}
);

// PUT /api/foundation/funds/:id - Update fund
router.put(
	'/:id',
	auth,
	authorize('admin', 'manager'),
	validate(updateFundValidation),
	async (req, res) => {
		try {
			const { id } = req.params;
			const updateData = req.body;
			const userId = req.user.id;

			let fund;
			if (mongoose.Types.ObjectId.isValid(id)) {
				fund = await Fund.findById(id);
			} else {
				fund = await Fund.findOne({ fundId: id });
			}

			if (!fund) {
				return res.status(404).json({
					success: false,
					message: 'Fund not found',
				});
			}

			// Check permission
			if (req.user.role !== 'admin' && fund.createdBy.toString() !== userId) {
				return res.status(403).json({
					success: false,
					message: 'You do not have permission to update this fund',
				});
			}

			// Preserve important fields
			delete updateData.fundId;
			delete updateData.foundationId;
			delete updateData.createdBy;

			// Set updatedBy
			updateData.updatedBy = userId;
			updateData.updatedAt = new Date();

			// If updating balance, recalculate available balance
			if (
				updateData.currentBalance !== undefined ||
				updateData.allocatedAmount !== undefined ||
				updateData.committedAmount !== undefined
			) {
				const currentBalance =
					updateData.currentBalance !== undefined
						? updateData.currentBalance
						: fund.currentBalance;
				const allocatedAmount =
					updateData.allocatedAmount !== undefined
						? updateData.allocatedAmount
						: fund.allocatedAmount;
				const committedAmount =
					updateData.committedAmount !== undefined
						? updateData.committedAmount
						: fund.committedAmount;

				updateData.availableBalance =
					currentBalance - allocatedAmount - committedAmount;
			}

			const updatedFund = await Fund.findByIdAndUpdate(
				fund._id,
				{ $set: updateData },
				{ new: true, runValidators: true }
			)
				.populate('foundationId', 'name')
				.populate('updatedBy', 'username email');

			res.json({
				success: true,
				message: 'Fund updated successfully',
				fund: updatedFund,
			});
		} catch (error) {
			console.error('Update Fund Error:', error);

			if (error.name === 'ValidationError') {
				const errors = Object.values(error.errors).map((err) => ({
					field: err.path,
					message: err.message,
				}));

				return res.status(400).json({
					success: false,
					message: 'Validation failed',
					errors,
				});
			}

			res.status(500).json({
				success: false,
				message: 'Failed to update fund',
				error: error.message,
			});
		}
	}
);

// DELETE /api/foundation/funds/:id - Delete fund (Admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
	try {
		const { id } = req.params;

		let fund;
		if (mongoose.Types.ObjectId.isValid(id)) {
			fund = await Fund.findById(id);
		} else {
			fund = await Fund.findOne({ fundId: id });
		}

		if (!fund) {
			return res.status(404).json({
				success: false,
				message: 'Fund not found',
			});
		}

		// Check if fund has transactions
		const hasDonations = await Donation.exists({ fundId: fund._id });
		const hasExpenses = await FoundationExpense.exists({ fundId: fund._id });

		if (hasDonations || hasExpenses) {
			return res.status(400).json({
				success: false,
				message: 'Cannot delete fund with transactions. Archive instead.',
				hasDonations,
				hasExpenses,
			});
		}

		await Fund.findByIdAndDelete(fund._id);

		// Update foundation statistics
		await Foundation.findByIdAndUpdate(fund.foundationId, {
			$inc: { 'statistics.totalFunds': -1 },
		});

		res.json({
			success: true,
			message: 'Fund deleted successfully',
			fundId: fund.fundId,
			name: fund.name,
		});
	} catch (error) {
		console.error('Delete Fund Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to delete fund',
			error: error.message,
		});
	}
});

// POST /api/foundation/funds/:id/approve - Approve fund (Admin only)
router.post('/:id/approve', auth, authorize('admin'), async (req, res) => {
	try {
		const { id } = req.params;
		const { notes } = req.body;

		let fund;
		if (mongoose.Types.ObjectId.isValid(id)) {
			fund = await Fund.findById(id);
		} else {
			fund = await Fund.findOne({ fundId: id });
		}

		if (!fund) {
			return res.status(404).json({
				success: false,
				message: 'Fund not found',
			});
		}

		if (fund.approvalStatus === 'approved') {
			return res.status(400).json({
				success: false,
				message: 'Fund is already approved',
			});
		}

		const updatedFund = await Fund.findByIdAndUpdate(
			fund._id,
			{
				$set: {
					approvalStatus: 'approved',
					approvedBy: req.user.id,
					approvalDate: new Date(),
					approvalNotes: notes,
					isActive: true,
				},
			},
			{ new: true }
		).populate('approvedBy', 'username email');

		res.json({
			success: true,
			message: 'Fund approved successfully',
			fund: updatedFund,
		});
	} catch (error) {
		console.error('Approve Fund Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to approve fund',
			error: error.message,
		});
	}
});

// POST /api/foundation/funds/:id/reject - Reject fund (Admin only)
router.post('/:id/reject', auth, authorize('admin'), async (req, res) => {
	try {
		const { id } = req.params;
		const { reason } = req.body;

		if (!reason) {
			return res.status(400).json({
				success: false,
				message: 'Rejection reason is required',
			});
		}

		let fund;
		if (mongoose.Types.ObjectId.isValid(id)) {
			fund = await Fund.findById(id);
		} else {
			fund = await Fund.findOne({ fundId: id });
		}

		if (!fund) {
			return res.status(404).json({
				success: false,
				message: 'Fund not found',
			});
		}

		const updatedFund = await Fund.findByIdAndUpdate(
			fund._id,
			{
				$set: {
					approvalStatus: 'rejected',
					rejectionReason: reason,
					rejectedBy: req.user.id,
					rejectionDate: new Date(),
					isActive: false,
				},
			},
			{ new: true }
		);

		res.json({
			success: true,
			message: 'Fund rejected successfully',
			fund: updatedFund,
		});
	} catch (error) {
		console.error('Reject Fund Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to reject fund',
			error: error.message,
		});
	}
});

// POST /api/foundation/funds/:id/activate - Activate fund
router.post(
	'/:id/activate',
	auth,
	authorize('admin', 'manager'),
	async (req, res) => {
		try {
			const { id } = req.params;

			let fund;
			if (mongoose.Types.ObjectId.isValid(id)) {
				fund = await Fund.findById(id);
			} else {
				fund = await Fund.findOne({ fundId: id });
			}

			if (!fund) {
				return res.status(404).json({
					success: false,
					message: 'Fund not found',
				});
			}

			if (fund.isActive) {
				return res.status(400).json({
					success: false,
					message: 'Fund is already active',
				});
			}

			const updatedFund = await Fund.findByIdAndUpdate(
				fund._id,
				{
					$set: {
						isActive: true,
						updatedBy: req.user.id,
						updatedAt: new Date(),
					},
				},
				{ new: true }
			);

			res.json({
				success: true,
				message: 'Fund activated successfully',
				fund: updatedFund,
			});
		} catch (error) {
			console.error('Activate Fund Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to activate fund',
				error: error.message,
			});
		}
	}
);

// POST /api/foundation/funds/:id/deactivate - Deactivate fund
router.post(
	'/:id/deactivate',
	auth,
	authorize('admin', 'manager'),
	async (req, res) => {
		try {
			const { id } = req.params;

			let fund;
			if (mongoose.Types.ObjectId.isValid(id)) {
				fund = await Fund.findById(id);
			} else {
				fund = await Fund.findOne({ fundId: id });
			}

			if (!fund) {
				return res.status(404).json({
					success: false,
					message: 'Fund not found',
				});
			}

			if (!fund.isActive) {
				return res.status(400).json({
					success: false,
					message: 'Fund is already inactive',
				});
			}

			const updatedFund = await Fund.findByIdAndUpdate(
				fund._id,
				{
					$set: {
						isActive: false,
						updatedBy: req.user.id,
						updatedAt: new Date(),
					},
				},
				{ new: true }
			);

			res.json({
				success: true,
				message: 'Fund deactivated successfully',
				fund: updatedFund,
			});
		} catch (error) {
			console.error('Deactivate Fund Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to deactivate fund',
				error: error.message,
			});
		}
	}
);

// GET /api/foundation/funds/:id/transactions - Get fund transactions
router.get('/:id/transactions', auth, async (req, res) => {
	try {
		const { id } = req.params;
		const { type, startDate, endDate, page = 1, limit = 20 } = req.query;
		const pageNum = parseInt(page);
		const limitNum = parseInt(limit);
		const skip = (pageNum - 1) * limitNum;

		let fund;
		if (mongoose.Types.ObjectId.isValid(id)) {
			fund = await Fund.findById(id);
		} else {
			fund = await Fund.findOne({ fundId: id });
		}

		if (!fund) {
			return res.status(404).json({
				success: false,
				message: 'Fund not found',
			});
		}

		// Build match conditions
		const matchConditions = { fundId: fund._id };

		if (type === 'donations') {
			matchConditions.type = 'donation';
		} else if (type === 'expenses') {
			matchConditions.type = 'expense';
		}

		if (startDate || endDate) {
			const dateField = type === 'donations' ? 'donationDate' : 'paymentDate';
			matchConditions[dateField] = {};
			if (startDate) matchConditions[dateField].$gte = new Date(startDate);
			if (endDate) matchConditions[dateField].$lte = new Date(endDate);
		}

		// Get donations
		const donationsQuery = {
			fundId: fund._id,
			status: 'received',
		};
		if (startDate) donationsQuery.donationDate = { $gte: new Date(startDate) };
		if (endDate) donationsQuery.donationDate = { $lte: new Date(endDate) };

		const [donations, totalDonations] = await Promise.all([
			Donation.find(donationsQuery)
				.sort({ donationDate: -1 })
				.skip(skip)
				.limit(limitNum),
			Donation.countDocuments(donationsQuery),
		]);

		// Get expenses
		const expensesQuery = {
			fundId: fund._id,
			status: 'paid',
		};
		if (startDate) expensesQuery.paymentDate = { $gte: new Date(startDate) };
		if (endDate) expensesQuery.paymentDate = { $lte: new Date(endDate) };

		const [expenses, totalExpenses] = await Promise.all([
			FoundationExpense.find(expensesQuery)
				.populate('projectId', 'title')
				.sort({ paymentDate: -1 })
				.skip(skip)
				.limit(limitNum),
			FoundationExpense.countDocuments(expensesQuery),
		]);

		// Calculate totals
		const donationTotal = donations.reduce(
			(sum, donation) => sum + donation.amount,
			0
		);
		const expenseTotal = expenses.reduce(
			(sum, expense) => sum + expense.totalAmount,
			0
		);
		const netFlow = donationTotal - expenseTotal;

		res.json({
			success: true,
			fund: {
				id: fund._id,
				name: fund.name,
				currentBalance: fund.currentBalance,
			},
			summary: {
				donationCount: totalDonations,
				donationTotal,
				expenseCount: totalExpenses,
				expenseTotal,
				netFlow,
				utilizationRate:
					donationTotal > 0 ? (expenseTotal / donationTotal) * 100 : 0,
			},
			donations: {
				count: donations.length,
				total: totalDonations,
				data: donations.map((donation) => ({
					id: donation._id,
					donationId: donation.donationId,
					date: donation.donationDate,
					donorName: donation.anonymous ? 'Anonymous' : donation.donorName,
					amount: donation.amount,
					currency: donation.currency,
					paymentMethod: donation.paymentMethod,
					status: donation.status,
				})),
			},
			expenses: {
				count: expenses.length,
				total: totalExpenses,
				data: expenses.map((expense) => ({
					id: expense._id,
					expenseId: expense.expenseId,
					date: expense.paymentDate,
					description: expense.description,
					payeeName: expense.payeeName,
					amount: expense.amount,
					taxAmount: expense.taxAmount,
					totalAmount: expense.totalAmount,
					category: expense.category,
					project: expense.projectId?.title,
				})),
			},
			pagination: {
				currentPage: pageNum,
				limit: limitNum,
			},
		});
	} catch (error) {
		console.error('Get Fund Transactions Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch fund transactions',
			error: error.message,
		});
	}
});

// GET /api/foundation/funds/:id/performance - Get fund performance metrics
router.get('/:id/performance', auth, async (req, res) => {
	try {
		const { id } = req.params;
		const { period = 'monthly' } = req.query;

		let fund;
		if (mongoose.Types.ObjectId.isValid(id)) {
			fund = await Fund.findById(id);
		} else {
			fund = await Fund.findOne({ fundId: id });
		}

		if (!fund) {
			return res.status(404).json({
				success: false,
				message: 'Fund not found',
			});
		}

		const now = new Date();
		let startDate;

		switch (period) {
			case 'weekly':
				startDate = new Date(now.setDate(now.getDate() - 7));
				break;
			case 'monthly':
				startDate = new Date(now.setMonth(now.getMonth() - 1));
				break;
			case 'quarterly':
				startDate = new Date(now.setMonth(now.getMonth() - 3));
				break;
			case 'yearly':
				startDate = new Date(now.setFullYear(now.getFullYear() - 1));
				break;
			default:
				startDate = new Date(now.setMonth(now.getMonth() - 1));
		}

		// Get donations and expenses for the period
		const [donations, expenses] = await Promise.all([
			Donation.aggregate([
				{
					$match: {
						fundId: fund._id,
						donationDate: { $gte: startDate },
						status: 'received',
					},
				},
				{
					$group: {
						_id: null,
						totalAmount: { $sum: '$amount' },
						count: { $sum: 1 },
						averageAmount: { $avg: '$amount' },
						maxAmount: { $max: '$amount' },
						minAmount: { $min: '$amount' },
					},
				},
			]),
			FoundationExpense.aggregate([
				{
					$match: {
						fundId: fund._id,
						paymentDate: { $gte: startDate },
						status: 'paid',
					},
				},
				{
					$group: {
						_id: null,
						totalAmount: { $sum: '$totalAmount' },
						count: { $sum: 1 },
						averageAmount: { $avg: '$totalAmount' },
						byCategory: {
							$push: {
								category: '$category',
								amount: '$totalAmount',
							},
						},
					},
				},
			]),
		]);

		const donationStats = donations[0] || {
			totalAmount: 0,
			count: 0,
			averageAmount: 0,
			maxAmount: 0,
			minAmount: 0,
		};

		const expenseStats = expenses[0] || {
			totalAmount: 0,
			count: 0,
			averageAmount: 0,
			byCategory: [],
		};

		// Calculate category breakdown
		const categoryBreakdown = {};
		expenseStats.byCategory.forEach((item) => {
			categoryBreakdown[item.category] =
				(categoryBreakdown[item.category] || 0) + item.amount;
		});

		// Calculate performance metrics
		const performanceMetrics = {
			period,
			startDate,
			endDate: new Date(),
			donations: donationStats,
			expenses: expenseStats,
			netFlow: donationStats.totalAmount - expenseStats.totalAmount,
			utilizationRate:
				donationStats.totalAmount > 0
					? (expenseStats.totalAmount / donationStats.totalAmount) * 100
					: 0,
			averageDonationSize: donationStats.averageAmount,
			averageExpenseSize: expenseStats.averageAmount,
			categoryBreakdown: Object.entries(categoryBreakdown).map(
				([category, amount]) => ({
					category,
					amount,
					percentage:
						expenseStats.totalAmount > 0
							? (amount / expenseStats.totalAmount) * 100
							: 0,
				})
			),
			fundHealth: {
				balanceHealth:
					fund.currentBalance > fund.targetAmount * 0.1 ? 'good' : 'warning',
				utilizationHealth:
					fund.performance.utilizationRate < 90 ? 'good' : 'warning',
				activityHealth:
					donationStats.count > 0 || expenseStats.count > 0
						? 'good'
						: 'inactive',
			},
		};

		res.json({
			success: true,
			fund: {
				id: fund._id,
				name: fund.name,
				currentBalance: fund.currentBalance,
				targetAmount: fund.targetAmount,
			},
			performance: performanceMetrics,
		});
	} catch (error) {
		console.error('Get Fund Performance Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch fund performance',
			error: error.message,
		});
	}
});

export default router;
