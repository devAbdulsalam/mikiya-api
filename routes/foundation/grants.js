import express from 'express';
import mongoose from 'mongoose';
import Grant from '../../models/Grant.js';
import Foundation from '../../models/Foundation.js';
import Fund from '../../models/Fund.js';
import Project from '../../models/Project.js';
import { auth, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validation.js';
import {
	grantValidation,
	updateGrantValidation,
} from '../../middlewares/foundationValidation.js';

const router = express.Router();

// GET /api/foundation/grants - Get all grants with filters
router.get('/', auth, async (req, res) => {
	try {
		const {
			foundationId,
			fundId,
			grantorType,
			status,
			startDate,
			endDate,
			search,
			page = 1,
			limit = 20,
			sortBy = 'applicationDate',
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
		if (grantorType) filter.grantorType = grantorType;
		if (status) filter.status = status;

		if (startDate || endDate) {
			filter.applicationDate = {};
			if (startDate) filter.applicationDate.$gte = new Date(startDate);
			if (endDate) filter.applicationDate.$lte = new Date(endDate);
		}

		if (search) {
			filter.$or = [
				{ title: { $regex: search, $options: 'i' } },
				{ description: { $regex: search, $options: 'i' } },
				{ grantorName: { $regex: search, $options: 'i' } },
				{ grantId: { $regex: search, $options: 'i' } },
			];
		}

		const [grants, total] = await Promise.all([
			Grant.find(filter)
				.populate('foundationId', 'name')
				.populate('fundId', 'name fundId')
				.populate(
					'projectManager',
					'username email profile.firstName profile.lastName'
				)
				.populate('createdBy', 'username email')
				.populate('approvedBy', 'username email')
				.sort({ [sortBy]: sortOrder })
				.skip(skip)
				.limit(limitNum),
			Grant.countDocuments(filter),
		]);

		// Calculate summary statistics
		const summary = {
			totalGrants: total,
			totalAmount: grants.reduce((sum, grant) => sum + grant.amount, 0),
			averageAmount:
				grants.length > 0
					? grants.reduce((sum, grant) => sum + grant.amount, 0) / grants.length
					: 0,
			byStatus: {},
			byGrantorType: {},
		};

		grants.forEach((grant) => {
			summary.byStatus[grant.status] =
				(summary.byStatus[grant.status] || 0) + 1;
			summary.byGrantorType[grant.grantorType] =
				(summary.byGrantorType[grant.grantorType] || 0) + 1;
		});

		const totalPages = Math.ceil(total / limitNum);
		const hasNextPage = pageNum < totalPages;
		const hasPrevPage = pageNum > 1;

		res.json({
			success: true,
			count: grants.length,
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
			grants: grants.map((grant) => ({
				id: grant._id,
				grantId: grant.grantId,
				foundation: grant.foundationId,
				fund: grant.fundId,
				grantorType: grant.grantorType,
				grantorName: grant.grantorName,
				grantorContact: grant.grantorContact,
				title: grant.title,
				description: grant.description,
				purpose: grant.purpose,
				amount: grant.amount,
				currency: grant.currency,
				applicationDate: grant.applicationDate,
				approvalDate: grant.approvalDate,
				startDate: grant.startDate,
				endDate: grant.endDate,
				reportingDates: grant.reportingDates,
				paymentSchedule: grant.paymentSchedule,
				requirements: grant.requirements,
				restrictions: grant.restrictions,
				reportingRequirements: grant.reportingRequirements,
				status: grant.status,
				progress: grant.progress,
				budget: grant.budget,
				expectedOutcomes: grant.expectedOutcomes,
				impactMetrics: grant.impactMetrics,
				projectManager: grant.projectManager,
				teamMembers: grant.teamMembers,
				documents: grant.documents,
				createdBy: grant.createdBy,
				approvedBy: grant.approvedBy,
				updatedBy: grant.updatedBy,
				notes: grant.notes,
				tags: grant.tags,
				createdAt: grant.createdAt,
				updatedAt: grant.updatedAt,
			})),
		});
	} catch (error) {
		console.error('Get Grants Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch grants',
			error: error.message,
		});
	}
});

// GET /api/foundation/grants/:id - Get single grant
router.get('/:id', auth, async (req, res) => {
	try {
		const { id } = req.params;

		let grant;
		if (mongoose.Types.ObjectId.isValid(id)) {
			grant = await Grant.findById(id)
				.populate('foundationId', 'name registrationNumber contact')
				.populate('fundId', 'name fundId purpose')
				.populate(
					'projectManager',
					'username email profile.firstName profile.lastName'
				)
				.populate(
					'teamMembers.userId',
					'username email profile.firstName profile.lastName'
				)
				.populate('createdBy', 'username email')
				.populate('approvedBy', 'username email')
				.populate('updatedBy', 'username email');
		} else {
			grant = await Grant.findOne({ grantId: id })
				.populate('foundationId', 'name registrationNumber contact')
				.populate('fundId', 'name fundId purpose')
				.populate(
					'projectManager',
					'username email profile.firstName profile.lastName'
				)
				.populate(
					'teamMembers.userId',
					'username email profile.firstName profile.lastName'
				)
				.populate('createdBy', 'username email')
				.populate('approvedBy', 'username email')
				.populate('updatedBy', 'username email');
		}

		if (!grant) {
			return res.status(404).json({
				success: false,
				message: 'Grant not found',
			});
		}

		// Get associated project if exists
		let associatedProject = null;
		if (grant.projectId) {
			associatedProject = await Project.findById(grant.projectId).select(
				'title description status progress budget'
			);
		}

		res.json({
			success: true,
			grant: {
				id: grant._id,
				grantId: grant.grantId,
				foundation: grant.foundationId,
				fund: grant.fundId,
				grantorType: grant.grantorType,
				grantorId: grant.grantorId,
				grantorName: grant.grantorName,
				grantorContact: grant.grantorContact,
				title: grant.title,
				description: grant.description,
				purpose: grant.purpose,
				amount: grant.amount,
				currency: grant.currency,
				applicationDate: grant.applicationDate,
				approvalDate: grant.approvalDate,
				startDate: grant.startDate,
				endDate: grant.endDate,
				reportingDates: grant.reportingDates,
				paymentSchedule: grant.paymentSchedule,
				requirements: grant.requirements,
				restrictions: grant.restrictions,
				reportingRequirements: grant.reportingRequirements,
				status: grant.status,
				progress: grant.progress,
				budget: grant.budget,
				expectedOutcomes: grant.expectedOutcomes,
				impactMetrics: grant.impactMetrics,
				projectManager: grant.projectManager,
				teamMembers: grant.teamMembers,
				documents: grant.documents,
				createdBy: grant.createdBy,
				approvedBy: grant.approvedBy,
				updatedBy: grant.updatedBy,
				notes: grant.notes,
				tags: grant.tags,
				createdAt: grant.createdAt,
				updatedAt: grant.updatedAt,
			},
			associatedProject,
		});
	} catch (error) {
		console.error('Get Grant Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch grant',
			error: error.message,
		});
	}
});

// POST /api/foundation/grants - Create a new grant application
router.post(
	'/',
	auth,
	authorize('admin', 'manager'),
	validate(grantValidation),
	async (req, res) => {
		try {
			const grantData = req.body;
			const userId = req.user.id;

			// Check if foundation exists
			const foundation = await Foundation.findById(grantData.foundationId);
			if (!foundation) {
				return res.status(404).json({
					success: false,
					message: 'Foundation not found',
				});
			}

			// Check if fund exists
			if (grantData.fundId) {
				const fund = await Fund.findById(grantData.fundId);
				if (!fund) {
					return res.status(404).json({
						success: false,
						message: 'Fund not found',
					});
				}
			}

			// Generate grant ID
			const timestamp = Date.now().toString().slice(-6);
			const random = Math.floor(Math.random() * 1000)
				.toString()
				.padStart(3, '0');
			grantData.grantId = `GRANT-${timestamp}-${random}`;

			// Set createdBy
			grantData.createdBy = userId;

			// Calculate duration if dates are provided
			if (grantData.startDate && grantData.endDate) {
				const start = new Date(grantData.startDate);
				const end = new Date(grantData.endDate);
				const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 30)); // months
				grantData.duration = duration;
			}

			// Initialize budget if not provided
			if (!grantData.budget) {
				grantData.budget = {
					totalAllocated: grantData.amount,
					totalSpent: 0,
					remaining: grantData.amount,
					categories: [],
				};
			}

			const grant = new Grant(grantData);
			await grant.save();

			const populatedGrant = await Grant.findById(grant._id)
				.populate('foundationId', 'name')
				.populate('fundId', 'name')
				.populate('createdBy', 'username email');

			res.status(201).json({
				success: true,
				message: 'Grant application created successfully',
				grant: populatedGrant,
			});
		} catch (error) {
			console.error('Create Grant Error:', error);

			if (error.code === 11000) {
				return res.status(400).json({
					success: false,
					message: 'Grant ID already exists',
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
				message: 'Failed to create grant application',
				error: error.message,
			});
		}
	}
);

// PUT /api/foundation/grants/:id - Update grant
router.put(
	'/:id',
	auth,
	authorize('admin', 'manager'),
	validate(updateGrantValidation),
	async (req, res) => {
		try {
			const { id } = req.params;
			const updateData = req.body;
			const userId = req.user.id;

			let grant;
			if (mongoose.Types.ObjectId.isValid(id)) {
				grant = await Grant.findById(id);
			} else {
				grant = await Grant.findOne({ grantId: id });
			}

			if (!grant) {
				return res.status(404).json({
					success: false,
					message: 'Grant not found',
				});
			}

			// Check permission - only admin or project manager can update
			const isProjectManager =
				grant.projectManager && grant.projectManager.toString() === userId;

			if (req.user.role !== 'admin' && !isProjectManager) {
				return res.status(403).json({
					success: false,
					message: 'You do not have permission to update this grant',
				});
			}

			// Preserve important fields
			delete updateData.grantId;
			delete updateData.foundationId;
			delete updateData.createdBy;

			// Set updatedBy
			updateData.updatedBy = userId;
			updateData.updatedAt = new Date();

			// Recalculate budget remaining if totalAllocated or totalSpent is updated
			if (updateData.budget) {
				if (
					updateData.budget.totalAllocated !== undefined ||
					updateData.budget.totalSpent !== undefined
				) {
					const totalAllocated =
						updateData.budget.totalAllocated !== undefined
							? updateData.budget.totalAllocated
							: grant.budget.totalAllocated;
					const totalSpent =
						updateData.budget.totalSpent !== undefined
							? updateData.budget.totalSpent
							: grant.budget.totalSpent;

					updateData.budget.remaining = totalAllocated - totalSpent;
				}
			}

			// Update progress if status changed
			if (updateData.status === 'completed' && grant.status !== 'completed') {
				updateData.progress = 100;
			}

			const updatedGrant = await Grant.findByIdAndUpdate(
				grant._id,
				{ $set: updateData },
				{ new: true, runValidators: true }
			)
				.populate('foundationId', 'name')
				.populate('fundId', 'name')
				.populate('updatedBy', 'username email');

			res.json({
				success: true,
				message: 'Grant updated successfully',
				grant: updatedGrant,
			});
		} catch (error) {
			console.error('Update Grant Error:', error);

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
				message: 'Failed to update grant',
				error: error.message,
			});
		}
	}
);

// POST /api/foundation/grants/:id/submit - Submit grant application
router.post(
	'/:id/submit',
	auth,
	authorize('admin', 'manager'),
	async (req, res) => {
		try {
			const { id } = req.params;

			let grant;
			if (mongoose.Types.ObjectId.isValid(id)) {
				grant = await Grant.findById(id);
			} else {
				grant = await Grant.findOne({ grantId: id });
			}

			if (!grant) {
				return res.status(404).json({
					success: false,
					message: 'Grant not found',
				});
			}

			if (grant.status !== 'draft') {
				return res.status(400).json({
					success: false,
					message: `Grant is already ${grant.status}`,
				});
			}

			const updatedGrant = await Grant.findByIdAndUpdate(
				grant._id,
				{
					$set: {
						status: 'submitted',
						updatedBy: req.user.id,
						updatedAt: new Date(),
					},
				},
				{ new: true }
			);

			res.json({
				success: true,
				message: 'Grant application submitted successfully',
				grant: updatedGrant,
			});
		} catch (error) {
			console.error('Submit Grant Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to submit grant application',
				error: error.message,
			});
		}
	}
);

// POST /api/foundation/grants/:id/approve - Approve grant (Admin only)
router.post('/:id/approve', auth, authorize('admin'), async (req, res) => {
	try {
		const { id } = req.params;
		const { notes } = req.body;

		let grant;
		if (mongoose.Types.ObjectId.isValid(id)) {
			grant = await Grant.findById(id);
		} else {
			grant = await Grant.findOne({ grantId: id });
		}

		if (!grant) {
			return res.status(404).json({
				success: false,
				message: 'Grant not found',
			});
		}

		if (grant.status === 'approved') {
			return res.status(400).json({
				success: false,
				message: 'Grant is already approved',
			});
		}

		const updatedGrant = await Grant.findByIdAndUpdate(
			grant._id,
			{
				$set: {
					status: 'approved',
					approvalDate: new Date(),
					approvedBy: req.user.id,
					updatedBy: req.user.id,
					updatedAt: new Date(),
					notes: notes
						? `${grant.notes || ''}\nApproval notes: ${notes}`
						: grant.notes,
				},
			},
			{ new: true }
		).populate('approvedBy', 'username email');

		// Update foundation statistics
		await Foundation.findByIdAndUpdate(grant.foundationId, {
			$inc: {
				'statistics.totalGrants.amount': grant.amount,
				'statistics.totalGrants.count': 1,
			},
		});

		res.json({
			success: true,
			message: 'Grant approved successfully',
			grant: updatedGrant,
		});
	} catch (error) {
		console.error('Approve Grant Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to approve grant',
			error: error.message,
		});
	}
});

// POST /api/foundation/grants/:id/reject - Reject grant (Admin only)
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

		let grant;
		if (mongoose.Types.ObjectId.isValid(id)) {
			grant = await Grant.findById(id);
		} else {
			grant = await Grant.findOne({ grantId: id });
		}

		if (!grant) {
			return res.status(404).json({
				success: false,
				message: 'Grant not found',
			});
		}

		const updatedGrant = await Grant.findByIdAndUpdate(
			grant._id,
			{
				$set: {
					status: 'rejected',
					updatedBy: req.user.id,
					updatedAt: new Date(),
					notes: `${grant.notes || ''}\nRejection reason: ${reason}`,
				},
			},
			{ new: true }
		);

		res.json({
			success: true,
			message: 'Grant rejected successfully',
			grant: updatedGrant,
		});
	} catch (error) {
		console.error('Reject Grant Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to reject grant',
			error: error.message,
		});
	}
});

// POST /api/foundation/grants/:id/activate - Activate grant
router.post(
	'/:id/activate',
	auth,
	authorize('admin', 'manager'),
	async (req, res) => {
		try {
			const { id } = req.params;

			let grant;
			if (mongoose.Types.ObjectId.isValid(id)) {
				grant = await Grant.findById(id);
			} else {
				grant = await Grant.findOne({ grantId: id });
			}

			if (!grant) {
				return res.status(404).json({
					success: false,
					message: 'Grant not found',
				});
			}

			if (grant.status !== 'approved') {
				return res.status(400).json({
					success: false,
					message: 'Grant must be approved before activation',
				});
			}

			if (grant.status === 'active') {
				return res.status(400).json({
					success: false,
					message: 'Grant is already active',
				});
			}

			const updatedGrant = await Grant.findByIdAndUpdate(
				grant._id,
				{
					$set: {
						status: 'active',
						startDate: new Date(), // Set actual start date
						updatedBy: req.user.id,
						updatedAt: new Date(),
					},
				},
				{ new: true }
			);

			res.json({
				success: true,
				message: 'Grant activated successfully',
				grant: updatedGrant,
			});
		} catch (error) {
			console.error('Activate Grant Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to activate grant',
				error: error.message,
			});
		}
	}
);

// POST /api/foundation/grants/:id/complete - Mark grant as completed
router.post(
	'/:id/complete',
	auth,
	authorize('admin', 'manager'),
	async (req, res) => {
		try {
			const { id } = req.params;
			const { finalReport } = req.body;

			let grant;
			if (mongoose.Types.ObjectId.isValid(id)) {
				grant = await Grant.findById(id);
			} else {
				grant = await Grant.findOne({ grantId: id });
			}

			if (!grant) {
				return res.status(404).json({
					success: false,
					message: 'Grant not found',
				});
			}

			if (grant.status !== 'active') {
				return res.status(400).json({
					success: false,
					message: 'Only active grants can be completed',
				});
			}

			const updateData = {
				status: 'completed',
				progress: 100,
				updatedBy: req.user.id,
				updatedAt: new Date(),
			};

			if (finalReport) {
				updateData.documents = [
					...(grant.documents || []),
					{
						documentType: 'final_report',
						name: 'Final Grant Report',
						url: finalReport,
						uploadDate: new Date(),
						version: '1.0',
					},
				];
			}

			const updatedGrant = await Grant.findByIdAndUpdate(
				grant._id,
				{ $set: updateData },
				{ new: true }
			);

			res.json({
				success: true,
				message: 'Grant marked as completed successfully',
				grant: updatedGrant,
			});
		} catch (error) {
			console.error('Complete Grant Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to complete grant',
				error: error.message,
			});
		}
	}
);

// POST /api/foundation/grants/:id/report - Submit grant report
router.post(
	'/:id/report',
	auth,
	authorize('admin', 'manager'),
	async (req, res) => {
		try {
			const { id } = req.params;
			const { reportType, reportUrl, dueDate } = req.body;

			if (!reportType || !reportUrl) {
				return res.status(400).json({
					success: false,
					message: 'Report type and URL are required',
				});
			}

			let grant;
			if (mongoose.Types.ObjectId.isValid(id)) {
				grant = await Grant.findById(id);
			} else {
				grant = await Grant.findOne({ grantId: id });
			}

			if (!grant) {
				return res.status(404).json({
					success: false,
					message: 'Grant not found',
				});
			}

			if (grant.status !== 'active') {
				return res.status(400).json({
					success: false,
					message: 'Only active grants can have reports submitted',
				});
			}

			// Update reporting requirements
			const reportingRequirements = grant.reportingRequirements || [];
			const reportIndex = reportingRequirements.findIndex(
				(req) => req.reportType === reportType && req.dueDate === dueDate
			);

			if (reportIndex > -1) {
				reportingRequirements[reportIndex].submitted = true;
				reportingRequirements[reportIndex].submissionDate = new Date();
				reportingRequirements[reportIndex].url = reportUrl;
			} else {
				reportingRequirements.push({
					reportType,
					dueDate: dueDate ? new Date(dueDate) : new Date(),
					frequency: 'once',
					submitted: true,
					submissionDate: new Date(),
					url: reportUrl,
				});
			}

			// Add to documents
			const documents = grant.documents || [];
			documents.push({
				documentType: 'grant_report',
				name: `${reportType} Report`,
				url: reportUrl,
				uploadDate: new Date(),
				version: '1.0',
			});

			const updatedGrant = await Grant.findByIdAndUpdate(
				grant._id,
				{
					$set: {
						reportingRequirements,
						documents,
						updatedBy: req.user.id,
						updatedAt: new Date(),
					},
				},
				{ new: true }
			);

			res.json({
				success: true,
				message: 'Grant report submitted successfully',
				grant: updatedGrant,
			});
		} catch (error) {
			console.error('Submit Grant Report Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to submit grant report',
				error: error.message,
			});
		}
	}
);

// POST /api/foundation/grants/:id/payment - Record grant payment
router.post(
	'/:id/payment',
	auth,
	authorize('admin', 'manager'),
	async (req, res) => {
		try {
			const { id } = req.params;
			const { installmentNumber, amount, paymentDate, reference } = req.body;

			if (!installmentNumber || !amount || !paymentDate) {
				return res.status(400).json({
					success: false,
					message: 'Installment number, amount, and payment date are required',
				});
			}

			let grant;
			if (mongoose.Types.ObjectId.isValid(id)) {
				grant = await Grant.findById(id);
			} else {
				grant = await Grant.findOne({ grantId: id });
			}

			if (!grant) {
				return res.status(404).json({
					success: false,
					message: 'Grant not found',
				});
			}

			// Update payment schedule
			const paymentSchedule = grant.paymentSchedule || [];
			const paymentIndex = paymentSchedule.findIndex(
				(payment) => payment.installmentNumber === parseInt(installmentNumber)
			);

			if (paymentIndex > -1) {
				paymentSchedule[paymentIndex].status = 'paid';
				paymentSchedule[paymentIndex].paymentDate = new Date(paymentDate);
				paymentSchedule[paymentIndex].reference = reference;
			} else {
				paymentSchedule.push({
					installmentNumber: parseInt(installmentNumber),
					amount: parseFloat(amount),
					dueDate: new Date(paymentDate),
					status: 'paid',
					paymentDate: new Date(paymentDate),
					reference,
				});
			}

			// Update budget
			const budget = grant.budget || {};
			budget.totalReceived = (budget.totalReceived || 0) + parseFloat(amount);
			budget.remaining =
				(budget.totalAllocated || 0) - (budget.totalReceived || 0);

			const updatedGrant = await Grant.findByIdAndUpdate(
				grant._id,
				{
					$set: {
						paymentSchedule,
						budget,
						updatedBy: req.user.id,
						updatedAt: new Date(),
					},
				},
				{ new: true }
			);

			res.json({
				success: true,
				message: 'Grant payment recorded successfully',
				grant: updatedGrant,
			});
		} catch (error) {
			console.error('Record Grant Payment Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to record grant payment',
				error: error.message,
			});
		}
	}
);

// GET /api/foundation/grants/:id/timeline - Get grant timeline
router.get('/:id/timeline', auth, async (req, res) => {
	try {
		const { id } = req.params;

		let grant;
		if (mongoose.Types.ObjectId.isValid(id)) {
			grant = await Grant.findById(id);
		} else {
			grant = await Grant.findOne({ grantId: id });
		}

		if (!grant) {
			return res.status(404).json({
				success: false,
				message: 'Grant not found',
			});
		}

		const timeline = [];

		// Add key dates
		if (grant.applicationDate) {
			timeline.push({
				date: grant.applicationDate,
				event: 'Application Submitted',
				description: 'Grant application was submitted',
				type: 'application',
			});
		}

		if (grant.approvalDate) {
			timeline.push({
				date: grant.approvalDate,
				event: 'Grant Approved',
				description: 'Grant was approved by review committee',
				type: 'approval',
			});
		}

		if (grant.startDate) {
			timeline.push({
				date: grant.startDate,
				event: 'Grant Started',
				description: 'Grant implementation period began',
				type: 'implementation',
			});
		}

		// Add payment schedule
		if (grant.paymentSchedule && grant.paymentSchedule.length > 0) {
			grant.paymentSchedule.forEach((payment) => {
				timeline.push({
					date: payment.dueDate,
					event: `Payment ${payment.installmentNumber} Due`,
					description: `Payment of ${grant.currency} ${payment.amount} due`,
					type: 'payment_due',
					status: payment.status,
				});

				if (payment.paymentDate) {
					timeline.push({
						date: payment.paymentDate,
						event: `Payment ${payment.installmentNumber} Received`,
						description: `Payment of ${grant.currency} ${payment.amount} received`,
						type: 'payment_received',
					});
				}
			});
		}

		// Add reporting deadlines
		if (grant.reportingRequirements && grant.reportingRequirements.length > 0) {
			grant.reportingRequirements.forEach((report) => {
				timeline.push({
					date: report.dueDate,
					event: `${report.reportType} Report Due`,
					description: `${report.reportType} report due to grantor`,
					type: 'report_due',
					status: report.submitted ? 'submitted' : 'pending',
				});

				if (report.submissionDate) {
					timeline.push({
						date: report.submissionDate,
						event: `${report.reportType} Report Submitted`,
						description: `${report.reportType} report was submitted`,
						type: 'report_submitted',
					});
				}
			});
		}

		if (grant.endDate) {
			timeline.push({
				date: grant.endDate,
				event: 'Grant Ended',
				description: 'Grant implementation period ended',
				type: 'completion',
			});
		}

		// Sort timeline by date
		timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

		res.json({
			success: true,
			grant: {
				id: grant._id,
				title: grant.title,
				status: grant.status,
			},
			timeline,
		});
	} catch (error) {
		console.error('Get Grant Timeline Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch grant timeline',
			error: error.message,
		});
	}
});

export default router;
