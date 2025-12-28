import express from 'express';
import mongoose from 'mongoose';
import FoundationExpense from '../../models/FoundationExpense.js';
import Foundation from '../../models/Foundation.js';
import Fund from '../../models/Fund.js';
import Project from '../../models/Project.js';
import { auth, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validation.js';
import {
	expenseValidation,
	updateExpenseValidation,
} from '../../middlewares/foundationValidation.js';

const router = express.Router();

// GET /api/foundation/expenses - Get all expenses with filters
router.get('/', auth, async (req, res) => {
	try {
		const {
			foundationId,
			fundId,
			projectId,
			expenseType,
			category,
			status,
			approvalStatus,
			startDate,
			endDate,
			search,
			page = 1,
			limit = 20,
			sortBy = 'paymentDate',
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

		if (fundId) filter.fundId = fundId;
		if (projectId) filter.projectId = projectId;
		if (expenseType) filter.expenseType = expenseType;
		if (category) filter.category = category;
		if (status) filter.status = status;
		if (approvalStatus) filter.approvalStatus = approvalStatus;

		if (startDate || endDate) {
			filter.paymentDate = {};
			if (startDate) filter.paymentDate.$gte = new Date(startDate);
			if (endDate) filter.paymentDate.$lte = new Date(endDate);
		}

		if (search) {
			filter.$or = [
				{ description: { $regex: search, $options: 'i' } },
				{ payeeName: { $regex: search, $options: 'i' } },
				{ expenseId: { $regex: search, $options: 'i' } },
				{ paymentReference: { $regex: search, $options: 'i' } },
			];
		}

		const [expenses, total] = await Promise.all([
			FoundationExpense.find(filter)
				.populate('foundationId', 'name')
				.populate('fundId', 'name fundId')
				.populate('projectId', 'title')
				.populate('submittedBy', 'username email')
				.populate('approvedBy', 'username email')
				.populate('paidBy', 'username email')
				.populate('verifiedBy', 'username email')
				.sort({ [sortBy]: sortOrder })
				.skip(skip)
				.limit(limitNum),
			FoundationExpense.countDocuments(filter),
		]);

		// Calculate summary statistics
		const summary = {
			totalExpenses: total,
			totalAmount: expenses.reduce(
				(sum, expense) => sum + expense.totalAmount,
				0
			),
			totalTax: expenses.reduce((sum, expense) => sum + expense.taxAmount, 0),
			averageAmount:
				expenses.length > 0
					? expenses.reduce((sum, expense) => sum + expense.totalAmount, 0) /
					  expenses.length
					: 0,
			byStatus: {},
			byExpenseType: {},
			byCategory: {},
		};

		expenses.forEach((expense) => {
			summary.byStatus[expense.status] =
				(summary.byStatus[expense.status] || 0) + 1;
			summary.byExpenseType[expense.expenseType] =
				(summary.byExpenseType[expense.expenseType] || 0) + 1;
			summary.byCategory[expense.category] =
				(summary.byCategory[expense.category] || 0) + 1;
		});

		const totalPages = Math.ceil(total / limitNum);
		const hasNextPage = pageNum < totalPages;
		const hasPrevPage = pageNum > 1;

		res.json({
			success: true,
			count: expenses.length,
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
			expenses: expenses.map((expense) => ({
				id: expense._id,
				expenseId: expense.expenseId,
				foundation: expense.foundationId,
				fund: expense.fundId,
				project: expense.projectId,
				expenseType: expense.expenseType,
				category: expense.category,
				subcategory: expense.subcategory,
				description: expense.description,
				amount: expense.amount,
				taxAmount: expense.taxAmount,
				totalAmount: expense.totalAmount,
				currency: expense.currency,
				expenseDate: expense.expenseDate,
				paymentDate: expense.paymentDate,
				dueDate: expense.dueDate,
				payeeType: expense.payeeType,
				payeeId: expense.payeeId,
				payeeName: expense.payeeName,
				payeeContact: expense.payeeContact,
				paymentMethod: expense.paymentMethod,
				paymentReference: expense.paymentReference,
				bankDetails: expense.bankDetails,
				requiresApproval: expense.requiresApproval,
				approvalStatus: expense.approvalStatus,
				approvedBy: expense.approvedBy,
				approvalDate: expense.approvalDate,
				approvalNotes: expense.approvalNotes,
				budgetLineItem: expense.budgetLineItem,
				budgetCategory: expense.budgetCategory,
				isBudgeted: expense.isBudgeted,
				budgetVariance: expense.budgetVariance,
				hasReceipt: expense.hasReceipt,
				receiptNumber: expense.receiptNumber,
				receiptDate: expense.receiptDate,
				attachments: expense.attachments,
				status: expense.status,
				isRecurring: expense.isRecurring,
				recurringDetails: expense.recurringDetails,
				submittedBy: expense.submittedBy,
				paidBy: expense.paidBy,
				verifiedBy: expense.verifiedBy,
				verificationDate: expense.verificationDate,
				notes: expense.notes,
				tags: expense.tags,
				createdAt: expense.createdAt,
				updatedAt: expense.updatedAt,
			})),
		});
	} catch (error) {
		console.error('Get Expenses Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch expenses',
			error: error.message,
		});
	}
});

// GET /api/foundation/expenses/:id - Get single expense
router.get('/:id', auth, async (req, res) => {
	try {
		const { id } = req.params;

		let expense;
		if (mongoose.Types.ObjectId.isValid(id)) {
			expense = await FoundationExpense.findById(id)
				.populate('foundationId', 'name registrationNumber contact')
				.populate('fundId', 'name fundId')
				.populate('projectId', 'title description')
				.populate(
					'submittedBy',
					'username email profile.firstName profile.lastName'
				)
				.populate('approvedBy', 'username email')
				.populate('paidBy', 'username email')
				.populate('verifiedBy', 'username email');
		} else {
			expense = await FoundationExpense.findOne({ expenseId: id })
				.populate('foundationId', 'name registrationNumber contact')
				.populate('fundId', 'name fundId')
				.populate('projectId', 'title description')
				.populate(
					'submittedBy',
					'username email profile.firstName profile.lastName'
				)
				.populate('approvedBy', 'username email')
				.populate('paidBy', 'username email')
				.populate('verifiedBy', 'username email');
		}

		if (!expense) {
			return res.status(404).json({
				success: false,
				message: 'Expense not found',
			});
		}

		res.json({
			success: true,
			expense: {
				id: expense._id,
				expenseId: expense.expenseId,
				foundation: expense.foundationId,
				fund: expense.fundId,
				project: expense.projectId,
				expenseType: expense.expenseType,
				category: expense.category,
				subcategory: expense.subcategory,
				description: expense.description,
				amount: expense.amount,
				taxAmount: expense.taxAmount,
				totalAmount: expense.totalAmount,
				currency: expense.currency,
				expenseDate: expense.expenseDate,
				paymentDate: expense.paymentDate,
				dueDate: expense.dueDate,
				payeeType: expense.payeeType,
				payeeId: expense.payeeId,
				payeeName: expense.payeeName,
				payeeContact: expense.payeeContact,
				paymentMethod: expense.paymentMethod,
				paymentReference: expense.paymentReference,
				bankDetails: expense.bankDetails,
				requiresApproval: expense.requiresApproval,
				approvalStatus: expense.approvalStatus,
				approvedBy: expense.approvedBy,
				approvalDate: expense.approvalDate,
				approvalNotes: expense.approvalNotes,
				budgetLineItem: expense.budgetLineItem,
				budgetCategory: expense.budgetCategory,
				isBudgeted: expense.isBudgeted,
				budgetVariance: expense.budgetVariance,
				hasReceipt: expense.hasReceipt,
				receiptNumber: expense.receiptNumber,
				receiptDate: expense.receiptDate,
				attachments: expense.attachments,
				status: expense.status,
				isRecurring: expense.isRecurring,
				recurringDetails: expense.recurringDetails,
				submittedBy: expense.submittedBy,
				paidBy: expense.paidBy,
				verifiedBy: expense.verifiedBy,
				verificationDate: expense.verificationDate,
				notes: expense.notes,
				tags: expense.tags,
				createdAt: expense.createdAt,
				updatedAt: expense.updatedAt,
			},
		});
	} catch (error) {
		console.error('Get Expense Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch expense',
			error: error.message,
		});
	}
});

// POST /api/foundation/expenses - Create a new expense
router.post(
	'/',
	auth,
	authorize('admin', 'manager', 'staff'),
	validate(expenseValidation),
	async (req, res) => {
		try {
			const expenseData = req.body;
			const userId = req.user.id;

			// Check if foundation exists
			const foundation = await Foundation.findById(expenseData.foundationId);
			if (!foundation) {
				return res.status(404).json({
					success: false,
					message: 'Foundation not found',
				});
			}

			// Check if fund exists
			const fund = await Fund.findById(expenseData.fundId);
			if (!fund) {
				return res.status(404).json({
					success: false,
					message: 'Fund not found',
				});
			}

			// Check if project exists (if provided)
			if (expenseData.projectId) {
				const project = await Project.findById(expenseData.projectId);
				if (!project) {
					return res.status(404).json({
						success: false,
						message: 'Project not found',
					});
				}
			}

			// Generate expense ID
			const timestamp = Date.now().toString().slice(-6);
			const random = Math.floor(Math.random() * 1000)
				.toString()
				.padStart(3, '0');
			expenseData.expenseId = `EXP-${timestamp}-${random}`;

			// Set submittedBy
			expenseData.submittedBy = userId;

			// Set total amount
			expenseData.totalAmount =
				expenseData.amount + (expenseData.taxAmount || 0);

			// Determine if approval is required based on amount and foundation settings
			const approvalThreshold = foundation.settings.approvalThreshold || 100000;
			if (
				expenseData.totalAmount >= approvalThreshold &&
				foundation.settings.requireApprovalForExpenses
			) {
				expenseData.requiresApproval = true;
				expenseData.approvalStatus = 'pending';
			} else {
				expenseData.requiresApproval = false;
				expenseData.approvalStatus = 'approved';
				expenseData.approvedBy = userId;
				expenseData.approvalDate = new Date();
			}

			// If expense is marked as paid, set payment date
			if (expenseData.status === 'paid' && !expenseData.paymentDate) {
				expenseData.paymentDate = new Date();
			}

			const expense = new FoundationExpense(expenseData);
			await expense.save();

			const populatedExpense = await FoundationExpense.findById(expense._id)
				.populate('foundationId', 'name')
				.populate('fundId', 'name')
				.populate('projectId', 'title')
				.populate('submittedBy', 'username email');

			res.status(201).json({
				success: true,
				message: 'Expense created successfully',
				expense: populatedExpense,
			});
		} catch (error) {
			console.error('Create Expense Error:', error);

			if (error.code === 11000) {
				return res.status(400).json({
					success: false,
					message: 'Expense ID already exists',
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
				message: 'Failed to create expense',
				error: error.message,
			});
		}
	}
);

// PUT /api/foundation/expenses/:id - Update expense
router.put(
	'/:id',
	auth,
	authorize('admin', 'manager'),
	validate(updateExpenseValidation),
	async (req, res) => {
		try {
			const { id } = req.params;
			const updateData = req.body;
			const userId = req.user.id;

			let expense;
			if (mongoose.Types.ObjectId.isValid(id)) {
				expense = await FoundationExpense.findById(id);
			} else {
				expense = await FoundationExpense.findOne({ expenseId: id });
			}

			if (!expense) {
				return res.status(404).json({
					success: false,
					message: 'Expense not found',
				});
			}

			// Check permission
			if (
				req.user.role !== 'admin' &&
				expense.submittedBy.toString() !== userId
			) {
				return res.status(403).json({
					success: false,
					message: 'You do not have permission to update this expense',
				});
			}

			// Cannot update paid expenses (except for notes)
			if (
				expense.status === 'paid' &&
				Object.keys(updateData).some((key) => !['notes', 'tags'].includes(key))
			) {
				return res.status(400).json({
					success: false,
					message: 'Cannot update paid expense',
				});
			}

			// Preserve important fields
			delete updateData.expenseId;
			delete updateData.foundationId;
			delete updateData.submittedBy;

			// Recalculate total amount if amount or tax is updated
			if (
				updateData.amount !== undefined ||
				updateData.taxAmount !== undefined
			) {
				const amount =
					updateData.amount !== undefined ? updateData.amount : expense.amount;
				const taxAmount =
					updateData.taxAmount !== undefined
						? updateData.taxAmount
						: expense.taxAmount;
				updateData.totalAmount = amount + taxAmount;
			}

			const updatedExpense = await FoundationExpense.findByIdAndUpdate(
				expense._id,
				{ $set: updateData },
				{ new: true, runValidators: true }
			)
				.populate('foundationId', 'name')
				.populate('fundId', 'name')
				.populate('projectId', 'title');

			res.json({
				success: true,
				message: 'Expense updated successfully',
				expense: updatedExpense,
			});
		} catch (error) {
			console.error('Update Expense Error:', error);

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
				message: 'Failed to update expense',
				error: error.message,
			});
		}
	}
);

// POST /api/foundation/expenses/:id/submit - Submit expense for approval
router.post(
	'/:id/submit',
	auth,
	authorize('admin', 'manager', 'staff'),
	async (req, res) => {
		try {
			const { id } = req.params;

			let expense;
			if (mongoose.Types.ObjectId.isValid(id)) {
				expense = await FoundationExpense.findById(id);
			} else {
				expense = await FoundationExpense.findOne({ expenseId: id });
			}

			if (!expense) {
				return res.status(404).json({
					success: false,
					message: 'Expense not found',
				});
			}

			if (expense.status !== 'draft') {
				return res.status(400).json({
					success: false,
					message: `Expense is already ${expense.status}`,
				});
			}

			const updatedExpense = await FoundationExpense.findByIdAndUpdate(
				expense._id,
				{
					$set: {
						status: 'submitted',
						updatedAt: new Date(),
					},
				},
				{ new: true }
			);

			res.json({
				success: true,
				message: 'Expense submitted for approval',
				expense: updatedExpense,
			});
		} catch (error) {
			console.error('Submit Expense Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to submit expense',
				error: error.message,
			});
		}
	}
);

// POST /api/foundation/expenses/:id/approve - Approve expense
router.post(
	'/:id/approve',
	auth,
	authorize('admin', 'manager'),
	async (req, res) => {
		try {
			const { id } = req.params;
			const { notes } = req.body;

			let expense;
			if (mongoose.Types.ObjectId.isValid(id)) {
				expense = await FoundationExpense.findById(id);
			} else {
				expense = await FoundationExpense.findOne({ expenseId: id });
			}

			if (!expense) {
				return res.status(404).json({
					success: false,
					message: 'Expense not found',
				});
			}

			if (expense.approvalStatus === 'approved') {
				return res.status(400).json({
					success: false,
					message: 'Expense is already approved',
				});
			}

			const updatedExpense = await FoundationExpense.findByIdAndUpdate(
				expense._id,
				{
					$set: {
						approvalStatus: 'approved',
						approvedBy: req.user.id,
						approvalDate: new Date(),
						approvalNotes: notes,
						updatedAt: new Date(),
					},
				},
				{ new: true }
			).populate('approvedBy', 'username email');

			res.json({
				success: true,
				message: 'Expense approved successfully',
				expense: updatedExpense,
			});
		} catch (error) {
			console.error('Approve Expense Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to approve expense',
				error: error.message,
			});
		}
	}
);

// POST /api/foundation/expenses/:id/reject - Reject expense
router.post(
	'/:id/reject',
	auth,
	authorize('admin', 'manager'),
	async (req, res) => {
		try {
			const { id } = req.params;
			const { reason } = req.body;

			if (!reason) {
				return res.status(400).json({
					success: false,
					message: 'Rejection reason is required',
				});
			}

			let expense;
			if (mongoose.Types.ObjectId.isValid(id)) {
				expense = await FoundationExpense.findById(id);
			} else {
				expense = await FoundationExpense.findOne({ expenseId: id });
			}

			if (!expense) {
				return res.status(404).json({
					success: false,
					message: 'Expense not found',
				});
			}

			const updatedExpense = await FoundationExpense.findByIdAndUpdate(
				expense._id,
				{
					$set: {
						approvalStatus: 'rejected',
						updatedAt: new Date(),
						notes: `${expense.notes || ''}\nRejection reason: ${reason}`,
					},
				},
				{ new: true }
			);

			res.json({
				success: true,
				message: 'Expense rejected',
				expense: updatedExpense,
			});
		} catch (error) {
			console.error('Reject Expense Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to reject expense',
				error: error.message,
			});
		}
	}
);

// POST /api/foundation/expenses/:id/pay - Mark expense as paid
router.post(
	'/:id/pay',
	auth,
	authorize('admin', 'manager'),
	async (req, res) => {
		try {
			const { id } = req.params;
			const { paymentMethod, paymentReference, paymentDate } = req.body;

			let expense;
			if (mongoose.Types.ObjectId.isValid(id)) {
				expense = await FoundationExpense.findById(id);
			} else {
				expense = await FoundationExpense.findOne({ expenseId: id });
			}

			if (!expense) {
				return res.status(404).json({
					success: false,
					message: 'Expense not found',
				});
			}

			if (expense.status === 'paid') {
				return res.status(400).json({
					success: false,
					message: 'Expense is already paid',
				});
			}

			if (expense.requiresApproval && expense.approvalStatus !== 'approved') {
				return res.status(400).json({
					success: false,
					message: 'Expense must be approved before payment',
				});
			}

			const updateData = {
				status: 'paid',
				paymentMethod: paymentMethod || expense.paymentMethod,
				paymentReference,
				paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
				paidBy: req.user.id,
				updatedAt: new Date(),
			};

			const updatedExpense = await FoundationExpense.findByIdAndUpdate(
				expense._id,
				{ $set: updateData },
				{ new: true }
			).populate('paidBy', 'username email');

			res.json({
				success: true,
				message: 'Expense marked as paid',
				expense: updatedExpense,
			});
		} catch (error) {
			console.error('Pay Expense Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to mark expense as paid',
				error: error.message,
			});
		}
	}
);

// POST /api/foundation/expenses/:id/verify - Verify expense receipt
router.post(
	'/:id/verify',
	auth,
	authorize('admin', 'manager'),
	async (req, res) => {
		try {
			const { id } = req.params;

			let expense;
			if (mongoose.Types.ObjectId.isValid(id)) {
				expense = await FoundationExpense.findById(id);
			} else {
				expense = await FoundationExpense.findOne({ expenseId: id });
			}

			if (!expense) {
				return res.status(404).json({
					success: false,
					message: 'Expense not found',
				});
			}

			if (!expense.hasReceipt) {
				return res.status(400).json({
					success: false,
					message: 'Expense does not have a receipt',
				});
			}

			if (expense.verifiedBy) {
				return res.status(400).json({
					success: false,
					message: 'Expense receipt is already verified',
				});
			}

			const updatedExpense = await FoundationExpense.findByIdAndUpdate(
				expense._id,
				{
					$set: {
						verifiedBy: req.user.id,
						verificationDate: new Date(),
						updatedAt: new Date(),
					},
				},
				{ new: true }
			).populate('verifiedBy', 'username email');

			res.json({
				success: true,
				message: 'Expense receipt verified',
				expense: updatedExpense,
			});
		} catch (error) {
			console.error('Verify Expense Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to verify expense receipt',
				error: error.message,
			});
		}
	}
);

// GET /api/foundation/expenses/approval/pending - Get pending approvals
router.get(
	'/approval/pending',
	auth,
	authorize('admin', 'manager'),
	async (req, res) => {
		try {
			const { foundationId } = req.query;

			if (!foundationId) {
				return res.status(400).json({
					success: false,
					message: 'Foundation ID is required',
				});
			}

			const pendingExpenses = await FoundationExpense.find({
				foundationId,
				approvalStatus: 'pending',
				status: { $in: ['submitted', 'draft'] },
			})
				.populate('foundationId', 'name')
				.populate('fundId', 'name')
				.populate('projectId', 'title')
				.populate(
					'submittedBy',
					'username email profile.firstName profile.lastName'
				)
				.sort({ createdAt: 1 });

			const summary = {
				totalPending: pendingExpenses.length,
				totalAmount: pendingExpenses.reduce(
					(sum, expense) => sum + expense.totalAmount,
					0
				),
				byExpenseType: {},
				bySubmittedBy: {},
			};

			pendingExpenses.forEach((expense) => {
				summary.byExpenseType[expense.expenseType] =
					(summary.byExpenseType[expense.expenseType] || 0) + 1;
				const submittedByName = expense.submittedBy?.profile?.firstName
					? `${expense.submittedBy.profile.firstName} ${expense.submittedBy.profile.lastName}`
					: expense.submittedBy?.username;
				summary.bySubmittedBy[submittedByName] =
					(summary.bySubmittedBy[submittedByName] || 0) + 1;
			});

			res.json({
				success: true,
				summary,
				expenses: pendingExpenses.map((expense) => ({
					id: expense._id,
					expenseId: expense.expenseId,
					description: expense.description,
					amount: expense.totalAmount,
					currency: expense.currency,
					expenseType: expense.expenseType,
					category: expense.category,
					fund: expense.fundId?.name,
					project: expense.projectId?.title,
					submittedBy: expense.submittedBy?.profile?.firstName
						? `${expense.submittedBy.profile.firstName} ${expense.submittedBy.profile.lastName}`
						: expense.submittedBy?.username,
					submittedDate: expense.createdAt,
					daysPending: Math.ceil(
						(new Date() - expense.createdAt) / (1000 * 60 * 60 * 24)
					),
				})),
			});
		} catch (error) {
			console.error('Get Pending Approvals Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to fetch pending approvals',
				error: error.message,
			});
		}
	}
);

// GET /api/foundation/expenses/stats/summary - Get expense statistics
router.get('/stats/summary', auth, async (req, res) => {
	try {
		const { foundationId, startDate, endDate } = req.query;

		if (!foundationId) {
			return res.status(400).json({
				success: false,
				message: 'Foundation ID is required',
			});
		}

		const start = startDate
			? new Date(startDate)
			: new Date(new Date().getFullYear(), 0, 1);
		const end = endDate
			? new Date(endDate)
			: new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999);

		const stats = await FoundationExpense.aggregate([
			{
				$match: {
					foundationId: mongoose.Types.ObjectId(foundationId),
					paymentDate: { $gte: start, $lte: end },
					status: 'paid',
				},
			},
			{
				$facet: {
					// Total statistics
					totalStats: [
						{
							$group: {
								_id: null,
								totalAmount: { $sum: '$totalAmount' },
								totalTax: { $sum: '$taxAmount' },
								count: { $sum: 1 },
								averageAmount: { $avg: '$totalAmount' },
								maxAmount: { $max: '$totalAmount' },
								minAmount: { $min: '$totalAmount' },
							},
						},
					],
					// Monthly trend
					monthlyTrend: [
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
					],
					// By expense type
					byExpenseType: [
						{
							$group: {
								_id: '$expenseType',
								totalAmount: { $sum: '$totalAmount' },
								count: { $sum: 1 },
							},
						},
						{
							$sort: { totalAmount: -1 },
						},
					],
					// By category
					byCategory: [
						{
							$group: {
								_id: '$category',
								totalAmount: { $sum: '$totalAmount' },
								count: { $sum: 1 },
							},
						},
						{
							$sort: { totalAmount: -1 },
						},
					],
					// By payment method
					byPaymentMethod: [
						{
							$group: {
								_id: '$paymentMethod',
								totalAmount: { $sum: '$totalAmount' },
								count: { $sum: 1 },
							},
						},
						{
							$sort: { totalAmount: -1 },
						},
					],
					// Top payees
					topPayees: [
						{
							$group: {
								_id: '$payeeName',
								totalAmount: { $sum: '$totalAmount' },
								count: { $sum: 1 },
							},
						},
						{
							$sort: { totalAmount: -1 },
						},
						{
							$limit: 10,
						},
					],
				},
			},
		]);

		const totalStats = stats[0].totalStats[0] || {
			totalAmount: 0,
			totalTax: 0,
			count: 0,
			averageAmount: 0,
			maxAmount: 0,
			minAmount: 0,
		};

		res.json({
			success: true,
			period: { start, end },
			summary: totalStats,
			monthlyTrend: stats[0].monthlyTrend || [],
			byExpenseType: stats[0].byExpenseType || [],
			byCategory: stats[0].byCategory || [],
			byPaymentMethod: stats[0].byPaymentMethod || [],
			topPayees: stats[0].topPayees || [],
		});
	} catch (error) {
		console.error('Get Expense Stats Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch expense statistics',
			error: error.message,
		});
	}
});

export default router;
