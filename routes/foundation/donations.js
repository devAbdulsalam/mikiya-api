import express from 'express';
import mongoose from 'mongoose';
import Donation from '../../models/Donation.js';
import Foundation from '../../models/Foundation.js';
import Fund from '../../models/Fund.js';
import { auth, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validation.js';
import {
	donationValidation,
	updateDonationValidation,
} from '../../middlewares/foundationValidation.js';
import { sendThankYouEmail } from '../../utils/emailTemplates.js';

const router = express.Router();

// GET /api/foundation/donations - Get all donations with filters
router.get('/', auth, async (req, res) => {
	try {
		const {
			foundationId,
			fundId,
			donorType,
			paymentMethod,
			designation,
			status,
			startDate,
			endDate,
			search,
			page = 1,
			limit = 20,
			sortBy = 'donationDate',
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
		if (donorType) filter.donorType = donorType;
		if (paymentMethod) filter.paymentMethod = paymentMethod;
		if (designation) filter.designation = designation;
		if (status) filter.status = status;

		if (startDate || endDate) {
			filter.donationDate = {};
			if (startDate) filter.donationDate.$gte = new Date(startDate);
			if (endDate) filter.donationDate.$lte = new Date(endDate);
		}

		if (search) {
			filter.$or = [
				{ donorName: { $regex: search, $options: 'i' } },
				{ donorEmail: { $regex: search, $options: 'i' } },
				{ donationId: { $regex: search, $options: 'i' } },
				{ referenceNumber: { $regex: search, $options: 'i' } },
			];
		}

		const [donations, total] = await Promise.all([
			Donation.find(filter)
				.populate('foundationId', 'name')
				.populate('fundId', 'name fundId')
				.populate('projectId', 'title')
				.populate('recordedBy', 'username email')
				.populate('verifiedBy', 'username email')
				.sort({ [sortBy]: sortOrder })
				.skip(skip)
				.limit(limitNum),
			Donation.countDocuments(filter),
		]);

		// Calculate summary statistics
		const summary = {
			totalDonations: total,
			totalAmount: donations.reduce(
				(sum, donation) => sum + donation.amount,
				0
			),
			averageAmount:
				donations.length > 0
					? donations.reduce((sum, donation) => sum + donation.amount, 0) /
					  donations.length
					: 0,
			byStatus: {},
			byDonorType: {},
			byPaymentMethod: {},
		};

		donations.forEach((donation) => {
			summary.byStatus[donation.status] =
				(summary.byStatus[donation.status] || 0) + 1;
			summary.byDonorType[donation.donorType] =
				(summary.byDonorType[donation.donorType] || 0) + 1;
			summary.byPaymentMethod[donation.paymentMethod] =
				(summary.byPaymentMethod[donation.paymentMethod] || 0) + 1;
		});

		const totalPages = Math.ceil(total / limitNum);
		const hasNextPage = pageNum < totalPages;
		const hasPrevPage = pageNum > 1;

		res.json({
			success: true,
			count: donations.length,
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
			donations: donations.map((donation) => ({
				id: donation._id,
				donationId: donation.donationId,
				foundation: donation.foundationId,
				fund: donation.fundId,
				project: donation.projectId,
				donorType: donation.donorType,
				donorName: donation.anonymous ? 'Anonymous' : donation.donorName,
				donorEmail: donation.donorEmail,
				donorPhone: donation.donorPhone,
				anonymous: donation.anonymous,
				amount: donation.amount,
				currency: donation.currency,
				donationDate: donation.donationDate,
				receiptDate: donation.receiptDate,
				paymentMethod: donation.paymentMethod,
				referenceNumber: donation.referenceNumber,
				designation: donation.designation,
				designationDetails: donation.designationDetails,
				isRecurring: donation.isRecurring,
				recurringDetails: donation.recurringDetails,
				taxDeductible: donation.taxDeductible,
				taxReceiptIssued: donation.taxReceiptIssued,
				taxReceiptNumber: donation.taxReceiptNumber,
				taxReceiptDate: donation.taxReceiptDate,
				acknowledged: donation.acknowledged,
				acknowledgmentMethod: donation.acknowledgmentMethod,
				acknowledgmentDate: donation.acknowledgmentDate,
				acknowledgmentNotes: donation.acknowledgmentNotes,
				status: donation.status,
				bankDetails: donation.bankDetails,
				recordedBy: donation.recordedBy,
				verifiedBy: donation.verifiedBy,
				verificationDate: donation.verificationDate,
				notes: donation.notes,
				attachments: donation.attachments,
				createdAt: donation.createdAt,
				updatedAt: donation.updatedAt,
			})),
		});
	} catch (error) {
		console.error('Get Donations Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch donations',
			error: error.message,
		});
	}
});

// GET /api/foundation/donations/:id - Get single donation
router.get('/:id', auth, async (req, res) => {
	try {
		const { id } = req.params;

		let donation;
		if (mongoose.Types.ObjectId.isValid(id)) {
			donation = await Donation.findById(id)
				.populate('foundationId', 'name registrationNumber contact')
				.populate('fundId', 'name fundId purpose')
				.populate('projectId', 'title description')
				.populate(
					'recordedBy',
					'username email profile.firstName profile.lastName'
				)
				.populate('verifiedBy', 'username email');
		} else {
			donation = await Donation.findOne({ donationId: id })
				.populate('foundationId', 'name registrationNumber contact')
				.populate('fundId', 'name fundId purpose')
				.populate('projectId', 'title description')
				.populate(
					'recordedBy',
					'username email profile.firstName profile.lastName'
				)
				.populate('verifiedBy', 'username email');
		}

		if (!donation) {
			return res.status(404).json({
				success: false,
				message: 'Donation not found',
			});
		}

		res.json({
			success: true,
			donation: {
				id: donation._id,
				donationId: donation.donationId,
				foundation: donation.foundationId,
				fund: donation.fundId,
				project: donation.projectId,
				donorType: donation.donorType,
				donorId: donation.donorId,
				donorName: donation.anonymous ? 'Anonymous' : donation.donorName,
				donorEmail: donation.donorEmail,
				donorPhone: donation.donorPhone,
				donorAddress: donation.donorAddress,
				anonymous: donation.anonymous,
				amount: donation.amount,
				currency: donation.currency,
				donationDate: donation.donationDate,
				receiptDate: donation.receiptDate,
				paymentMethod: donation.paymentMethod,
				referenceNumber: donation.referenceNumber,
				designation: donation.designation,
				designationDetails: donation.designationDetails,
				isRecurring: donation.isRecurring,
				recurringDetails: donation.recurringDetails,
				taxDeductible: donation.taxDeductible,
				taxReceiptIssued: donation.taxReceiptIssued,
				taxReceiptNumber: donation.taxReceiptNumber,
				taxReceiptDate: donation.taxReceiptDate,
				acknowledged: donation.acknowledged,
				acknowledgmentMethod: donation.acknowledgmentMethod,
				acknowledgmentDate: donation.acknowledgmentDate,
				acknowledgmentNotes: donation.acknowledgmentNotes,
				status: donation.status,
				bankDetails: donation.bankDetails,
				recordedBy: donation.recordedBy,
				verifiedBy: donation.verifiedBy,
				verificationDate: donation.verificationDate,
				notes: donation.notes,
				attachments: donation.attachments,
				createdAt: donation.createdAt,
				updatedAt: donation.updatedAt,
			},
		});
	} catch (error) {
		console.error('Get Donation Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch donation',
			error: error.message,
		});
	}
});

// POST /api/foundation/donations - Record a new donation
router.post(
	'/',
	auth,
	authorize('admin', 'manager', 'staff'),
	validate(donationValidation),
	async (req, res) => {
		try {
			const donationData = req.body;
			const userId = req.user.id;

			// Check if foundation exists
			const foundation = await Foundation.findById(donationData.foundationId);
			if (!foundation) {
				return res.status(404).json({
					success: false,
					message: 'Foundation not found',
				});
			}

			// Check if fund exists
			const fund = await Fund.findById(donationData.fundId);
			if (!fund) {
				return res.status(404).json({
					success: false,
					message: 'Fund not found',
				});
			}

			// Generate donation ID
			const timestamp = Date.now().toString().slice(-6);
			const random = Math.floor(Math.random() * 1000)
				.toString()
				.padStart(3, '0');
			donationData.donationId = `DON-${timestamp}-${random}`;

			// Set recordedBy
			donationData.recordedBy = userId;

			// Set receipt date if not provided
			if (!donationData.receiptDate) {
				donationData.receiptDate = new Date();
			}

			// If donation is marked as received, set status
			if (donationData.status === 'received') {
				donationData.receiptDate = new Date();
			}

			const donation = new Donation(donationData);
			await donation.save();

			// Send thank you email if email is provided and not anonymous
			if (donationData.donorEmail && !donationData.anonymous) {
				try {
					await sendThankYouEmail({
						to: donationData.donorEmail,
						donorName: donationData.donorName,
						amount: donationData.amount,
						currency: donationData.currency,
						donationDate: donationData.donationDate,
						donationId: donationData.donationId,
						foundationName: foundation.name,
					});

					donation.acknowledged = true;
					donation.acknowledgmentMethod = 'email';
					donation.acknowledgmentDate = new Date();
					await donation.save();
				} catch (emailError) {
					console.error('Failed to send thank you email:', emailError);
					// Don't fail the donation if email fails
				}
			}

			const populatedDonation = await Donation.findById(donation._id)
				.populate('foundationId', 'name')
				.populate('fundId', 'name')
				.populate('recordedBy', 'username email');

			res.status(201).json({
				success: true,
				message: 'Donation recorded successfully',
				donation: populatedDonation,
			});
		} catch (error) {
			console.error('Create Donation Error:', error);

			if (error.code === 11000) {
				return res.status(400).json({
					success: false,
					message: 'Donation ID already exists',
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
				message: 'Failed to record donation',
				error: error.message,
			});
		}
	}
);

// PUT /api/foundation/donations/:id - Update donation
router.put(
	'/:id',
	auth,
	authorize('admin', 'manager'),
	validate(updateDonationValidation),
	async (req, res) => {
		try {
			const { id } = req.params;
			const updateData = req.body;
			const userId = req.user.id;

			let donation;
			if (mongoose.Types.ObjectId.isValid(id)) {
				donation = await Donation.findById(id);
			} else {
				donation = await Donation.findOne({ donationId: id });
			}

			if (!donation) {
				return res.status(404).json({
					success: false,
					message: 'Donation not found',
				});
			}

			// Check if donation status is being updated to 'received'
			if (updateData.status === 'received' && donation.status !== 'received') {
				updateData.receiptDate = new Date();
			}

			// Preserve important fields
			delete updateData.donationId;
			delete updateData.foundationId;
			delete updateData.recordedBy;

			const updatedDonation = await Donation.findByIdAndUpdate(
				donation._id,
				{ $set: updateData },
				{ new: true, runValidators: true }
			)
				.populate('foundationId', 'name')
				.populate('fundId', 'name');

			res.json({
				success: true,
				message: 'Donation updated successfully',
				donation: updatedDonation,
			});
		} catch (error) {
			console.error('Update Donation Error:', error);

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
				message: 'Failed to update donation',
				error: error.message,
			});
		}
	}
);

// POST /api/foundation/donations/:id/verify - Verify donation
router.post(
	'/:id/verify',
	auth,
	authorize('admin', 'manager'),
	async (req, res) => {
		try {
			const { id } = req.params;

			let donation;
			if (mongoose.Types.ObjectId.isValid(id)) {
				donation = await Donation.findById(id);
			} else {
				donation = await Donation.findOne({ donationId: id });
			}

			if (!donation) {
				return res.status(404).json({
					success: false,
					message: 'Donation not found',
				});
			}

			if (donation.verifiedBy) {
				return res.status(400).json({
					success: false,
					message: 'Donation is already verified',
				});
			}

			const updatedDonation = await Donation.findByIdAndUpdate(
				donation._id,
				{
					$set: {
						verifiedBy: req.user.id,
						verificationDate: new Date(),
					},
				},
				{ new: true }
			).populate('verifiedBy', 'username email');

			res.json({
				success: true,
				message: 'Donation verified successfully',
				donation: updatedDonation,
			});
		} catch (error) {
			console.error('Verify Donation Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to verify donation',
				error: error.message,
			});
		}
	}
);

// POST /api/foundation/donations/:id/acknowledge - Acknowledge donation
router.post(
	'/:id/acknowledge',
	auth,
	authorize('admin', 'manager', 'staff'),
	async (req, res) => {
		try {
			const { id } = req.params;
			const { method, notes } = req.body;

			let donation;
			if (mongoose.Types.ObjectId.isValid(id)) {
				donation = await Donation.findById(id);
			} else {
				donation = await Donation.findOne({ donationId: id });
			}

			if (!donation) {
				return res.status(404).json({
					success: false,
					message: 'Donation not found',
				});
			}

			if (donation.acknowledged) {
				return res.status(400).json({
					success: false,
					message: 'Donation is already acknowledged',
				});
			}

			const updatedDonation = await Donation.findByIdAndUpdate(
				donation._id,
				{
					$set: {
						acknowledged: true,
						acknowledgmentMethod: method || 'email',
						acknowledgmentDate: new Date(),
						acknowledgmentNotes: notes,
					},
				},
				{ new: true }
			);

			// Send acknowledgment email if method is email and donor email exists
			if (method === 'email' && donation.donorEmail && !donation.anonymous) {
				try {
					await sendThankYouEmail({
						to: donation.donorEmail,
						donorName: donation.donorName,
						amount: donation.amount,
						currency: donation.currency,
						donationDate: donation.donationDate,
						donationId: donation.donationId,
						foundationName: donation.foundationId.name,
					});
				} catch (emailError) {
					console.error('Failed to send acknowledgment email:', emailError);
				}
			}

			res.json({
				success: true,
				message: 'Donation acknowledged successfully',
				donation: updatedDonation,
			});
		} catch (error) {
			console.error('Acknowledge Donation Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to acknowledge donation',
				error: error.message,
			});
		}
	}
);

// POST /api/foundation/donations/:id/issue-receipt - Issue tax receipt
router.post(
	'/:id/issue-receipt',
	auth,
	authorize('admin', 'manager'),
	async (req, res) => {
		try {
			const { id } = req.params;

			let donation;
			if (mongoose.Types.ObjectId.isValid(id)) {
				donation = await Donation.findById(id);
			} else {
				donation = await Donation.findOne({ donationId: id });
			}

			if (!donation) {
				return res.status(404).json({
					success: false,
					message: 'Donation not found',
				});
			}

			if (!donation.taxDeductible) {
				return res.status(400).json({
					success: false,
					message: 'Donation is not tax deductible',
				});
			}

			if (donation.taxReceiptIssued) {
				return res.status(400).json({
					success: false,
					message: 'Tax receipt already issued',
				});
			}

			// Generate tax receipt number
			const year = new Date().getFullYear();
			const receiptNumber = `TR-${year}-${Math.floor(Math.random() * 10000)
				.toString()
				.padStart(4, '0')}`;

			const updatedDonation = await Donation.findByIdAndUpdate(
				donation._id,
				{
					$set: {
						taxReceiptIssued: true,
						taxReceiptNumber: receiptNumber,
						taxReceiptDate: new Date(),
					},
				},
				{ new: true }
			);

			res.json({
				success: true,
				message: 'Tax receipt issued successfully',
				donation: updatedDonation,
				receiptNumber,
			});
		} catch (error) {
			console.error('Issue Tax Receipt Error:', error);
			res.status(500).json({
				success: false,
				message: 'Failed to issue tax receipt',
				error: error.message,
			});
		}
	}
);

// GET /api/foundation/donations/donor/:donorEmail - Get donor history
router.get('/donor/:donorEmail', auth, async (req, res) => {
	try {
		const { donorEmail } = req.params;
		const { foundationId } = req.query;

		if (!foundationId) {
			return res.status(400).json({
				success: false,
				message: 'Foundation ID is required',
			});
		}

		const donations = await Donation.find({
			foundationId,
			donorEmail,
			anonymous: false,
		})
			.populate('fundId', 'name')
			.populate('projectId', 'title')
			.sort({ donationDate: -1 });

		const donorSummary = {
			totalDonations: donations.length,
			totalAmount: donations.reduce(
				(sum, donation) => sum + donation.amount,
				0
			),
			firstDonation:
				donations.length > 0
					? donations[donations.length - 1].donationDate
					: null,
			lastDonation: donations.length > 0 ? donations[0].donationDate : null,
			averageDonation:
				donations.length > 0
					? donations.reduce((sum, donation) => sum + donation.amount, 0) /
					  donations.length
					: 0,
		};

		res.json({
			success: true,
			donor: {
				email: donorEmail,
				name: donations.length > 0 ? donations[0].donorName : 'Unknown',
			},
			summary: donorSummary,
			donations: donations.map((donation) => ({
				id: donation._id,
				donationId: donation.donationId,
				date: donation.donationDate,
				amount: donation.amount,
				currency: donation.currency,
				fund: donation.fundId?.name,
				project: donation.projectId?.title,
				designation: donation.designation,
				status: donation.status,
				taxReceiptIssued: donation.taxReceiptIssued,
			})),
		});
	} catch (error) {
		console.error('Get Donor History Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch donor history',
			error: error.message,
		});
	}
});

// GET /api/foundation/donations/stats/summary - Get donation statistics
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

		const stats = await Donation.aggregate([
			{
				$match: {
					foundationId: mongoose.Types.ObjectId(foundationId),
					donationDate: { $gte: start, $lte: end },
					status: 'received',
				},
			},
			{
				$facet: {
					// Total statistics
					totalStats: [
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
					],
					// Monthly trend
					monthlyTrend: [
						{
							$group: {
								_id: {
									year: { $year: '$donationDate' },
									month: { $month: '$donationDate' },
								},
								totalAmount: { $sum: '$amount' },
								count: { $sum: 1 },
							},
						},
						{
							$sort: { '_id.year': 1, '_id.month': 1 },
						},
					],
					// By donor type
					byDonorType: [
						{
							$group: {
								_id: '$donorType',
								totalAmount: { $sum: '$amount' },
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
								totalAmount: { $sum: '$amount' },
								count: { $sum: 1 },
							},
						},
						{
							$sort: { totalAmount: -1 },
						},
					],
					// Top donors
					topDonors: [
						{
							$group: {
								_id: '$donorName',
								totalAmount: { $sum: '$amount' },
								count: { $sum: 1 },
								firstDonation: { $min: '$donationDate' },
								lastDonation: { $max: '$donationDate' },
							},
						},
						{
							$sort: { totalAmount: -1 },
						},
						{
							$limit: 10,
						},
					],
					// Recurring donations
					recurringStats: [
						{
							$match: { isRecurring: true },
						},
						{
							$group: {
								_id: null,
								totalAmount: { $sum: '$amount' },
								count: { $sum: 1 },
								averageAmount: { $avg: '$amount' },
							},
						},
					],
				},
			},
		]);

		const totalStats = stats[0].totalStats[0] || {
			totalAmount: 0,
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
			byDonorType: stats[0].byDonorType || [],
			byPaymentMethod: stats[0].byPaymentMethod || [],
			topDonors: stats[0].topDonors || [],
			recurringStats: stats[0].recurringStats[0] || {
				totalAmount: 0,
				count: 0,
				averageAmount: 0,
			},
		});
	} catch (error) {
		console.error('Get Donation Stats Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to fetch donation statistics',
			error: error.message,
		});
	}
});

export default router;
