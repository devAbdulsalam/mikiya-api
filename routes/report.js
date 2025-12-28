import express from 'express';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import Foundation from '../models/Foundation.js';
import Fund from '../models/Fund.js';
import Donation from '../models/Donation.js';
import Grant from '../models/Grant.js';
import FoundationExpense from '../models/FoundationExpense.js';
import Project from '../models/Project.js';
import Beneficiary from '../models/Beneficiary.js';
import CashFlow from '../models/CashFlow.js';
import FoundationInvoice from '../models/FoundationInvoice.js';
import { auth } from '../middlewares/auth.js';
import { formatCurrency, formatDate } from '../utils/helpers.js';

const router = express.Router();

// GET /api/reports/financial - Generate financial report
router.get('/financial', auth, async (req, res) => {
	try {
		const {
			foundationId,
			startDate,
			endDate,
			format = 'json',
			includeComparative = false,
		} = req.query;

		if (!foundationId) {
			return res.status(400).json({
				success: false,
				message: 'Foundation ID is required',
			});
		}

		const foundation = await Foundation.findById(foundationId);
		if (!foundation) {
			return res.status(404).json({
				success: false,
				message: 'Foundation not found',
			});
		}

		const start = startDate
			? new Date(startDate)
			: new Date(new Date().getFullYear(), 0, 1);
		const end = endDate
			? new Date(endDate)
			: new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999);

		// Get all financial data for the period
		const [donations, grants, expenses, cashFlows, funds] = await Promise.all([
			// Donations
			Donation.aggregate([
				{
					$match: {
						foundationId: mongoose.Types.ObjectId(foundationId),
						donationDate: { $gte: start, $lte: end },
						status: 'received',
					},
				},
				{
					$group: {
						_id: null,
						totalAmount: { $sum: '$amount' },
						count: { $sum: 1 },
						averageAmount: { $avg: '$amount' },
						byDonorType: {
							$push: {
								donorType: '$donorType',
								amount: '$amount',
							},
						},
						byMonth: {
							$push: {
								month: { $month: '$donationDate' },
								year: { $year: '$donationDate' },
								amount: '$amount',
							},
						},
					},
				},
			]),

			// Grants
			Grant.aggregate([
				{
					$match: {
						foundationId: mongoose.Types.ObjectId(foundationId),
						approvalDate: { $gte: start, $lte: end },
						status: { $in: ['approved', 'active', 'completed'] },
					},
				},
				{
					$group: {
						_id: null,
						totalAmount: { $sum: '$amount' },
						count: { $sum: 1 },
						averageAmount: { $avg: '$amount' },
						byGrantorType: {
							$push: {
								grantorType: '$grantorType',
								amount: '$amount',
							},
						},
						byStatus: {
							$push: {
								status: '$status',
								amount: '$amount',
							},
						},
					},
				},
			]),

			// Expenses
			FoundationExpense.aggregate([
				{
					$match: {
						foundationId: mongoose.Types.ObjectId(foundationId),
						paymentDate: { $gte: start, $lte: end },
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
						byExpenseType: {
							$push: {
								expenseType: '$expenseType',
								amount: '$totalAmount',
							},
						},
						byMonth: {
							$push: {
								month: { $month: '$paymentDate' },
								year: { $year: '$paymentDate' },
								amount: '$totalAmount',
							},
						},
					},
				},
			]),

			// Cash Flows
			CashFlow.find({
				foundationId,
				periodDate: { $gte: start, $lte: end },
				period: 'monthly',
			}).sort({ periodDate: 1 }),

			// Funds
			Fund.find({ foundationId }),
		]);

		// Get comparative data if requested
		let comparativeData = null;
		if (includeComparative === 'true') {
			const prevStart = new Date(start);
			prevStart.setFullYear(prevStart.getFullYear() - 1);
			const prevEnd = new Date(end);
			prevEnd.setFullYear(prevEnd.getFullYear() - 1);

			const [prevDonations, prevExpenses] = await Promise.all([
				Donation.aggregate([
					{
						$match: {
							foundationId: mongoose.Types.ObjectId(foundationId),
							donationDate: { $gte: prevStart, $lte: prevEnd },
							status: 'received',
						},
					},
					{
						$group: {
							_id: null,
							totalAmount: { $sum: '$amount' },
						},
					},
				]),
				FoundationExpense.aggregate([
					{
						$match: {
							foundationId: mongoose.Types.ObjectId(foundationId),
							paymentDate: { $gte: prevStart, $lte: prevEnd },
							status: 'paid',
						},
					},
					{
						$group: {
							_id: null,
							totalAmount: { $sum: '$totalAmount' },
						},
					},
				]),
			]);

			comparativeData = {
				previousPeriod: {
					start: prevStart,
					end: prevEnd,
				},
				donations: {
					amount: prevDonations[0]?.totalAmount || 0,
					change: donations[0]?.totalAmount
						? ((donations[0].totalAmount -
								(prevDonations[0]?.totalAmount || 0)) /
								(prevDonations[0]?.totalAmount || 1)) *
						  100
						: 0,
				},
				expenses: {
					amount: prevExpenses[0]?.totalAmount || 0,
					change: expenses[0]?.totalAmount
						? ((expenses[0].totalAmount - (prevExpenses[0]?.totalAmount || 0)) /
								(prevExpenses[0]?.totalAmount || 1)) *
						  100
						: 0,
				},
			};
		}

		// Process aggregated data
		const donationData = donations[0] || {
			totalAmount: 0,
			count: 0,
			averageAmount: 0,
			byDonorType: [],
			byMonth: [],
		};
		const grantData = grants[0] || {
			totalAmount: 0,
			count: 0,
			averageAmount: 0,
			byGrantorType: [],
			byStatus: [],
		};
		const expenseData = expenses[0] || {
			totalAmount: 0,
			count: 0,
			averageAmount: 0,
			byCategory: [],
			byExpenseType: [],
			byMonth: [],
		};

		// Group by donor type
		const donorTypeSummary = {};
		donationData.byDonorType?.forEach((item) => {
			donorTypeSummary[item.donorType] =
				(donorTypeSummary[item.donorType] || 0) + item.amount;
		});

		// Group by grantor type
		const grantorTypeSummary = {};
		grantData.byGrantorType?.forEach((item) => {
			grantorTypeSummary[item.grantorType] =
				(grantorTypeSummary[item.grantorType] || 0) + item.amount;
		});

		// Group expenses by category
		const expenseCategorySummary = {};
		expenseData.byCategory?.forEach((item) => {
			expenseCategorySummary[item.category] =
				(expenseCategorySummary[item.category] || 0) + item.amount;
		});

		// Group expenses by type
		const expenseTypeSummary = {};
		expenseData.byExpenseType?.forEach((item) => {
			expenseTypeSummary[item.expenseType] =
				(expenseTypeSummary[item.expenseType] || 0) + item.amount;
		});

		// Monthly breakdown
		const monthlyDonations = {};
		donationData.byMonth?.forEach((item) => {
			const key = `${item.year}-${item.month}`;
			monthlyDonations[key] = (monthlyDonations[key] || 0) + item.amount;
		});

		const monthlyExpenses = {};
		expenseData.byMonth?.forEach((item) => {
			const key = `${item.year}-${item.month}`;
			monthlyExpenses[key] = (monthlyExpenses[key] || 0) + item.amount;
		});

		// Calculate financial ratios
		const totalRevenue = donationData.totalAmount + grantData.totalAmount;
		const totalExpenses = expenseData.totalAmount;
		const netIncome = totalRevenue - totalExpenses;

		const financialRatios = {
			programEfficiency: expenseTypeSummary.program
				? (expenseTypeSummary.program / totalExpenses) * 100
				: 0,
			fundraisingEfficiency: expenseTypeSummary.fundraising
				? (expenseTypeSummary.fundraising / donationData.totalAmount) * 100
				: 0,
			administrativeRatio: expenseTypeSummary.administrative
				? (expenseTypeSummary.administrative / totalExpenses) * 100
				: 0,
			netProfitMargin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
			operatingMargin:
				totalRevenue > 0
					? ((donationData.totalAmount - expenseData.totalAmount) /
							donationData.totalAmount) *
					  100
					: 0,
		};

		// Fund balances
		const fundBalances = funds.map((fund) => ({
			name: fund.name,
			type: fund.type,
			currentBalance: fund.currentBalance,
			allocatedAmount: fund.allocatedAmount,
			availableBalance: fund.availableBalance,
			utilizationRate: fund.performance.utilizationRate,
		}));

		// Prepare report data
		const reportData = {
			foundation: {
				id: foundation._id,
				name: foundation.name,
				registrationNumber: foundation.registrationNumber,
				currency: foundation.currency,
			},
			period: {
				start,
				end,
				duration: Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 30)), // in months
			},
			summary: {
				totalRevenue,
				totalExpenses,
				netIncome,
				donationAmount: donationData.totalAmount,
				donationCount: donationData.count,
				averageDonation: donationData.averageAmount,
				grantAmount: grantData.totalAmount,
				grantCount: grantData.count,
				averageGrant: grantData.averageAmount,
				expenseAmount: expenseData.totalAmount,
				expenseCount: expenseData.count,
				averageExpense: expenseData.averageAmount,
			},
			breakdowns: {
				byDonorType: Object.entries(donorTypeSummary).map(([type, amount]) => ({
					type,
					amount,
					percentage: (amount / donationData.totalAmount) * 100,
				})),
				byGrantorType: Object.entries(grantorTypeSummary).map(
					([type, amount]) => ({
						type,
						amount,
						percentage: (amount / grantData.totalAmount) * 100,
					})
				),
				byExpenseCategory: Object.entries(expenseCategorySummary).map(
					([category, amount]) => ({
						category,
						amount,
						percentage: (amount / expenseData.totalAmount) * 100,
					})
				),
				byExpenseType: Object.entries(expenseTypeSummary).map(
					([type, amount]) => ({
						type,
						amount,
						percentage: (amount / expenseData.totalAmount) * 100,
					})
				),
			},
			monthlyTrends: {
				donations: Object.entries(monthlyDonations).map(([month, amount]) => ({
					month,
					amount,
				})),
				expenses: Object.entries(monthlyExpenses).map(([month, amount]) => ({
					month,
					amount,
				})),
			},
			financialRatios,
			fundBalances,
			cashFlows: cashFlows.map((cf) => ({
				periodDate: cf.periodDate,
				openingBalance: cf.openingBalance,
				closingBalance: cf.closingBalance,
				netCashFlow: cf.netCashFlow,
				inflows: cf.inflows.totalInflows,
				outflows: cf.outflows.totalOutflows,
			})),
			comparativeData,
			generatedAt: new Date(),
		};

		// Handle different output formats
		if (format === 'pdf') {
			return generateFinancialPDF(res, reportData);
		} else if (format === 'excel') {
			return generateFinancialExcel(res, reportData);
		} else if (format === 'csv') {
			return generateFinancialCSV(res, reportData);
		}

		// Default JSON response
		res.json({
			success: true,
			message: 'Financial report generated successfully',
			report: reportData,
		});
	} catch (error) {
		console.error('Financial Report Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to generate financial report',
			error: error.message,
		});
	}
});

// GET /api/reports/donations - Generate donation report
router.get('/donations', auth, async (req, res) => {
	try {
		const {
			foundationId,
			startDate,
			endDate,
			donorType,
			paymentMethod,
			designation,
			format = 'json',
			page = 1,
			limit = 100,
		} = req.query;

		if (!foundationId) {
			return res.status(400).json({
				success: false,
				message: 'Foundation ID is required',
			});
		}

		const foundation = await Foundation.findById(foundationId);
		if (!foundation) {
			return res.status(404).json({
				success: false,
				message: 'Foundation not found',
			});
		}

		const start = startDate
			? new Date(startDate)
			: new Date(new Date().getFullYear(), 0, 1);
		const end = endDate
			? new Date(endDate)
			: new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999);
		const pageNum = parseInt(page);
		const limitNum = parseInt(limit);
		const skip = (pageNum - 1) * limitNum;

		// Build filter
		const filter = {
			foundationId,
			donationDate: { $gte: start, $lte: end },
			status: 'received',
		};

		if (donorType) filter.donorType = donorType;
		if (paymentMethod) filter.paymentMethod = paymentMethod;
		if (designation) filter.designation = designation;

		// Get donations with pagination
		const [donations, total] = await Promise.all([
			Donation.find(filter)
				.populate('fundId', 'name')
				.sort({ donationDate: -1 })
				.skip(skip)
				.limit(limitNum),
			Donation.countDocuments(filter),
		]);

		// Get aggregate statistics
		const aggregates = await Donation.aggregate([
			{
				$match: filter,
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
					// By donor type
					byDonorType: [
						{
							$group: {
								_id: '$donorType',
								totalAmount: { $sum: '$amount' },
								count: { $sum: 1 },
								averageAmount: { $avg: '$amount' },
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
					// By designation
					byDesignation: [
						{
							$group: {
								_id: '$designation',
								totalAmount: { $sum: '$amount' },
								count: { $sum: 1 },
							},
						},
						{
							$sort: { totalAmount: -1 },
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

		const totalStats = aggregates[0].totalStats[0] || {
			totalAmount: 0,
			count: 0,
			averageAmount: 0,
			maxAmount: 0,
			minAmount: 0,
		};
		const byDonorType = aggregates[0].byDonorType || [];
		const byPaymentMethod = aggregates[0].byPaymentMethod || [];
		const byDesignation = aggregates[0].byDesignation || [];
		const monthlyTrend = aggregates[0].monthlyTrend || [];
		const topDonors = aggregates[0].topDonors || [];
		const recurringStats = aggregates[0].recurringStats[0] || {
			totalAmount: 0,
			count: 0,
			averageAmount: 0,
		};

		// Calculate donor retention (if we had donor IDs)
		const donorRetention = {
			newDonors: 0,
			returningDonors: 0,
			retentionRate: 0,
		};

		// Prepare report data
		const reportData = {
			foundation: {
				id: foundation._id,
				name: foundation.name,
				currency: foundation.currency,
			},
			period: {
				start,
				end,
			},
			filter: {
				donorType,
				paymentMethod,
				designation,
			},
			pagination: {
				currentPage: pageNum,
				totalPages: Math.ceil(total / limitNum),
				totalItems: total,
				itemsPerPage: limitNum,
			},
			summary: {
				totalAmount: totalStats.totalAmount,
				totalDonations: totalStats.count,
				averageDonation: totalStats.averageAmount,
				largestDonation: totalStats.maxAmount,
				smallestDonation: totalStats.minAmount,
				recurringDonations: {
					amount: recurringStats.totalAmount,
					count: recurringStats.count,
					percentage:
						totalStats.totalAmount > 0
							? (recurringStats.totalAmount / totalStats.totalAmount) * 100
							: 0,
				},
			},
			breakdowns: {
				byDonorType: byDonorType.map((item) => ({
					type: item._id,
					amount: item.totalAmount,
					count: item.count,
					average: item.averageAmount,
					percentage:
						totalStats.totalAmount > 0
							? (item.totalAmount / totalStats.totalAmount) * 100
							: 0,
				})),
				byPaymentMethod: byPaymentMethod.map((item) => ({
					method: item._id,
					amount: item.totalAmount,
					count: item.count,
					percentage:
						totalStats.totalAmount > 0
							? (item.totalAmount / totalStats.totalAmount) * 100
							: 0,
				})),
				byDesignation: byDesignation.map((item) => ({
					designation: item._id,
					amount: item.totalAmount,
					count: item.count,
					percentage:
						totalStats.totalAmount > 0
							? (item.totalAmount / totalStats.totalAmount) * 100
							: 0,
				})),
			},
			trends: {
				monthly: monthlyTrend.map((item) => ({
					year: item._id.year,
					month: item._id.month,
					amount: item.totalAmount,
					count: item.count,
				})),
			},
			topDonors: topDonors.map((donor) => ({
				name: donor._id,
				totalAmount: donor.totalAmount,
				donationCount: donor.count,
				firstDonation: donor.firstDonation,
				lastDonation: donor.lastDonation,
				averageDonation: donor.totalAmount / donor.count,
			})),
			donorRetention,
			donations: donations.map((donation) => ({
				id: donation._id,
				donationId: donation.donationId,
				date: donation.donationDate,
				donorName: donation.anonymous ? 'Anonymous' : donation.donorName,
				donorType: donation.donorType,
				amount: donation.amount,
				currency: donation.currency,
				paymentMethod: donation.paymentMethod,
				designation: donation.designation,
				isRecurring: donation.isRecurring,
				status: donation.status,
				acknowledged: donation.acknowledged,
				fund: donation.fundId?.name,
			})),
			generatedAt: new Date(),
		};

		// Handle different output formats
		if (format === 'pdf') {
			return generateDonationPDF(res, reportData);
		} else if (format === 'excel') {
			return generateDonationExcel(res, reportData);
		} else if (format === 'csv') {
			return generateDonationCSV(res, reportData);
		}

		// Default JSON response
		res.json({
			success: true,
			message: 'Donation report generated successfully',
			report: reportData,
		});
	} catch (error) {
		console.error('Donation Report Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to generate donation report',
			error: error.message,
		});
	}
});

// GET /api/reports/expenses - Generate expense report
router.get('/expenses', auth, async (req, res) => {
	try {
		const {
			foundationId,
			startDate,
			endDate,
			expenseType,
			category,
			approvalStatus,
			format = 'json',
			page = 1,
			limit = 100,
		} = req.query;

		if (!foundationId) {
			return res.status(400).json({
				success: false,
				message: 'Foundation ID is required',
			});
		}

		const foundation = await Foundation.findById(foundationId);
		if (!foundation) {
			return res.status(404).json({
				success: false,
				message: 'Foundation not found',
			});
		}

		const start = startDate
			? new Date(startDate)
			: new Date(new Date().getFullYear(), 0, 1);
		const end = endDate
			? new Date(endDate)
			: new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999);
		const pageNum = parseInt(page);
		const limitNum = parseInt(limit);
		const skip = (pageNum - 1) * limitNum;

		// Build filter
		const filter = {
			foundationId,
			paymentDate: { $gte: start, $lte: end },
			status: 'paid',
		};

		if (expenseType) filter.expenseType = expenseType;
		if (category) filter.category = category;
		if (approvalStatus) filter.approvalStatus = approvalStatus;

		// Get expenses with pagination
		const [expenses, total] = await Promise.all([
			FoundationExpense.find(filter)
				.populate('fundId', 'name')
				.populate('projectId', 'title')
				.sort({ paymentDate: -1 })
				.skip(skip)
				.limit(limitNum),
			FoundationExpense.countDocuments(filter),
		]);

		// Get aggregate statistics
		const aggregates = await FoundationExpense.aggregate([
			{
				$match: filter,
			},
			{
				$facet: {
					// Total statistics
					totalStats: [
						{
							$group: {
								_id: null,
								totalAmount: { $sum: '$totalAmount' },
								count: { $sum: 1 },
								averageAmount: { $avg: '$totalAmount' },
								maxAmount: { $max: '$totalAmount' },
								minAmount: { $min: '$totalAmount' },
								taxAmount: { $sum: '$taxAmount' },
							},
						},
					],
					// By expense type
					byExpenseType: [
						{
							$group: {
								_id: '$expenseType',
								totalAmount: { $sum: '$totalAmount' },
								count: { $sum: 1 },
								averageAmount: { $avg: '$totalAmount' },
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
					// Top payees
					topPayees: [
						{
							$group: {
								_id: '$payeeName',
								totalAmount: { $sum: '$totalAmount' },
								count: { $sum: 1 },
								firstPayment: { $min: '$paymentDate' },
								lastPayment: { $max: '$paymentDate' },
							},
						},
						{
							$sort: { totalAmount: -1 },
						},
						{
							$limit: 10,
						},
					],
					// By fund
					byFund: [
						{
							$lookup: {
								from: 'funds',
								localField: 'fundId',
								foreignField: '_id',
								as: 'fund',
							},
						},
						{
							$unwind: '$fund',
						},
						{
							$group: {
								_id: '$fund.name',
								totalAmount: { $sum: '$totalAmount' },
								count: { $sum: 1 },
							},
						},
						{
							$sort: { totalAmount: -1 },
						},
					],
					// By project
					byProject: [
						{
							$match: { projectId: { $ne: null } },
						},
						{
							$lookup: {
								from: 'projects',
								localField: 'projectId',
								foreignField: '_id',
								as: 'project',
							},
						},
						{
							$unwind: '$project',
						},
						{
							$group: {
								_id: '$project.title',
								totalAmount: { $sum: '$totalAmount' },
								count: { $sum: 1 },
							},
						},
						{
							$sort: { totalAmount: -1 },
						},
					],
				},
			},
		]);

		const totalStats = aggregates[0].totalStats[0] || {
			totalAmount: 0,
			count: 0,
			averageAmount: 0,
			maxAmount: 0,
			minAmount: 0,
			taxAmount: 0,
		};
		const byExpenseType = aggregates[0].byExpenseType || [];
		const byCategory = aggregates[0].byCategory || [];
		const byPaymentMethod = aggregates[0].byPaymentMethod || [];
		const monthlyTrend = aggregates[0].monthlyTrend || [];
		const topPayees = aggregates[0].topPayees || [];
		const byFund = aggregates[0].byFund || [];
		const byProject = aggregates[0].byProject || [];

		// Prepare report data
		const reportData = {
			foundation: {
				id: foundation._id,
				name: foundation.name,
				currency: foundation.currency,
			},
			period: {
				start,
				end,
			},
			filter: {
				expenseType,
				category,
				approvalStatus,
			},
			pagination: {
				currentPage: pageNum,
				totalPages: Math.ceil(total / limitNum),
				totalItems: total,
				itemsPerPage: limitNum,
			},
			summary: {
				totalAmount: totalStats.totalAmount,
				totalExpenses: totalStats.count,
				averageExpense: totalStats.averageAmount,
				largestExpense: totalStats.maxAmount,
				smallestExpense: totalStats.minAmount,
				taxAmount: totalStats.taxAmount,
				netAmount: totalStats.totalAmount - totalStats.taxAmount,
			},
			breakdowns: {
				byExpenseType: byExpenseType.map((item) => ({
					type: item._id,
					amount: item.totalAmount,
					count: item.count,
					average: item.averageAmount,
					percentage:
						totalStats.totalAmount > 0
							? (item.totalAmount / totalStats.totalAmount) * 100
							: 0,
				})),
				byCategory: byCategory.map((item) => ({
					category: item._id,
					amount: item.totalAmount,
					count: item.count,
					percentage:
						totalStats.totalAmount > 0
							? (item.totalAmount / totalStats.totalAmount) * 100
							: 0,
				})),
				byPaymentMethod: byPaymentMethod.map((item) => ({
					method: item._id,
					amount: item.totalAmount,
					count: item.count,
					percentage:
						totalStats.totalAmount > 0
							? (item.totalAmount / totalStats.totalAmount) * 100
							: 0,
				})),
				byFund: byFund.map((item) => ({
					fund: item._id,
					amount: item.totalAmount,
					count: item.count,
					percentage:
						totalStats.totalAmount > 0
							? (item.totalAmount / totalStats.totalAmount) * 100
							: 0,
				})),
				byProject: byProject.map((item) => ({
					project: item._id,
					amount: item.totalAmount,
					count: item.count,
					percentage:
						totalStats.totalAmount > 0
							? (item.totalAmount / totalStats.totalAmount) * 100
							: 0,
				})),
			},
			trends: {
				monthly: monthlyTrend.map((item) => ({
					year: item._id.year,
					month: item._id.month,
					amount: item.totalAmount,
					count: item.count,
				})),
			},
			topPayees: topPayees.map((payee) => ({
				name: payee._id,
				totalAmount: payee.totalAmount,
				expenseCount: payee.count,
				firstPayment: payee.firstPayment,
				lastPayment: payee.lastPayment,
				averagePayment: payee.totalAmount / payee.count,
			})),
			expenses: expenses.map((expense) => ({
				id: expense._id,
				expenseId: expense.expenseId,
				date: expense.paymentDate,
				description: expense.description,
				payeeName: expense.payeeName,
				expenseType: expense.expenseType,
				category: expense.category,
				amount: expense.amount,
				taxAmount: expense.taxAmount,
				totalAmount: expense.totalAmount,
				currency: expense.currency,
				paymentMethod: expense.paymentMethod,
				fund: expense.fundId?.name,
				project: expense.projectId?.title,
				approvalStatus: expense.approvalStatus,
				hasReceipt: expense.hasReceipt,
			})),
			generatedAt: new Date(),
		};

		// Handle different output formats
		if (format === 'pdf') {
			return generateExpensePDF(res, reportData);
		} else if (format === 'excel') {
			return generateExpenseExcel(res, reportData);
		} else if (format === 'csv') {
			return generateExpenseCSV(res, reportData);
		}

		// Default JSON response
		res.json({
			success: true,
			message: 'Expense report generated successfully',
			report: reportData,
		});
	} catch (error) {
		console.error('Expense Report Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to generate expense report',
			error: error.message,
		});
	}
});

// GET /api/reports/projects - Generate project report
router.get('/projects', auth, async (req, res) => {
	try {
		const {
			foundationId,
			status,
			category,
			health,
			format = 'json',
			includeBeneficiaries = false,
		} = req.query;

		if (!foundationId) {
			return res.status(400).json({
				success: false,
				message: 'Foundation ID is required',
			});
		}

		const foundation = await Foundation.findById(foundationId);
		if (!foundation) {
			return res.status(404).json({
				success: false,
				message: 'Foundation not found',
			});
		}

		// Build filter
		const filter = { foundationId };
		if (status) filter.status = status;
		if (category) filter.category = category;
		if (health) filter.health = health;

		// Get projects
		const projects = await Project.find(filter)
			.populate('fundId', 'name')
			.populate(
				'projectManager',
				'username email profile.firstName profile.lastName'
			)
			.sort({ startDate: -1 });

		// Get aggregate statistics
		const aggregates = await Project.aggregate([
			{
				$match: filter,
			},
			{
				$facet: {
					// Total statistics
					totalStats: [
						{
							$group: {
								_id: null,
								totalBudget: { $sum: '$budget.totalBudget' },
								totalSpent: { $sum: '$budget.spentBudget' },
								totalRemaining: { $sum: '$budget.remainingBudget' },
								count: { $sum: 1 },
								averageBudget: { $avg: '$budget.totalBudget' },
								averageDuration: { $avg: '$duration' },
							},
						},
					],
					// By status
					byStatus: [
						{
							$group: {
								_id: '$status',
								totalBudget: { $sum: '$budget.totalBudget' },
								totalSpent: { $sum: '$budget.spentBudget' },
								count: { $sum: 1 },
								averageProgress: { $avg: '$progress' },
							},
						},
						{
							$sort: { count: -1 },
						},
					],
					// By category
					byCategory: [
						{
							$group: {
								_id: '$category',
								totalBudget: { $sum: '$budget.totalBudget' },
								totalSpent: { $sum: '$budget.spentBudget' },
								count: { $sum: 1 },
								averageProgress: { $avg: '$progress' },
							},
						},
						{
							$sort: { count: -1 },
						},
					],
					// By health
					byHealth: [
						{
							$group: {
								_id: '$health',
								totalBudget: { $sum: '$budget.totalBudget' },
								totalSpent: { $sum: '$budget.spentBudget' },
								count: { $sum: 1 },
								averageProgress: { $avg: '$progress' },
							},
						},
						{
							$sort: { count: -1 },
						},
					],
					// Beneficiary statistics
					beneficiaryStats: [
						{
							$group: {
								_id: null,
								totalTarget: { $sum: '$beneficiaries.target' },
								totalReached: { $sum: '$beneficiaries.reached' },
								averageReachRate: {
									$avg: {
										$cond: [
											{ $gt: ['$beneficiaries.target', 0] },
											{
												$divide: [
													'$beneficiaries.reached',
													'$beneficiaries.target',
												],
											},
											0,
										],
									},
								},
							},
						},
					],
					// Funding sources
					fundingSources: [
						{
							$unwind: '$fundingSources',
						},
						{
							$group: {
								_id: '$fundingSources.sourceType',
								totalAmount: { $sum: '$fundingSources.amount' },
								totalCommitted: { $sum: '$fundingSources.committed' },
								totalReceived: { $sum: '$fundingSources.received' },
								count: { $sum: 1 },
							},
						},
						{
							$sort: { totalAmount: -1 },
						},
					],
				},
			},
		]);

		const totalStats = aggregates[0].totalStats[0] || {
			totalBudget: 0,
			totalSpent: 0,
			totalRemaining: 0,
			count: 0,
			averageBudget: 0,
			averageDuration: 0,
		};
		const byStatus = aggregates[0].byStatus || [];
		const byCategory = aggregates[0].byCategory || [];
		const byHealth = aggregates[0].byHealth || [];
		const beneficiaryStats = aggregates[0].beneficiaryStats[0] || {
			totalTarget: 0,
			totalReached: 0,
			averageReachRate: 0,
		};
		const fundingSources = aggregates[0].fundingSources || [];

		// Calculate utilization rate
		const budgetUtilization =
			totalStats.totalBudget > 0
				? (totalStats.totalSpent / totalStats.totalBudget) * 100
				: 0;

		// Get beneficiary details if requested
		let beneficiaryDetails = null;
		if (includeBeneficiaries === 'true') {
			const projectIds = projects.map((p) => p._id);
			beneficiaryDetails = await Beneficiary.aggregate([
				{
					$match: {
						foundationId: mongoose.Types.ObjectId(foundationId),
						projectId: { $in: projectIds },
					},
				},
				{
					$group: {
						_id: '$projectId',
						count: { $sum: 1 },
						demographics: {
							$push: {
								gender: '$gender',
								age: '$age',
								enrollmentDate: '$enrollment.date',
							},
						},
					},
				},
			]);
		}

		// Prepare project details
		const projectDetails = projects.map((project) => ({
			id: project._id,
			projectId: project.projectId,
			title: project.title,
			description: project.description.substring(0, 200) + '...',
			category: project.category,
			status: project.status,
			health: project.health,
			progress: project.progress,
			startDate: project.startDate,
			endDate: project.endDate,
			duration: project.duration,
			budget: {
				total: project.budget.totalBudget,
				spent: project.budget.spentBudget,
				remaining: project.budget.remainingBudget,
				utilization:
					project.budget.totalBudget > 0
						? (project.budget.spentBudget / project.budget.totalBudget) * 100
						: 0,
			},
			beneficiaries: {
				target: project.beneficiaries.target,
				reached: project.beneficiaries.reached,
				reachRate:
					project.beneficiaries.target > 0
						? (project.beneficiaries.reached / project.beneficiaries.target) *
						  100
						: 0,
			},
			projectManager: project.projectManager
				? `${project.projectManager.profile?.firstName || ''} ${
						project.projectManager.profile?.lastName || ''
				  }`.trim()
				: 'Not assigned',
			fundingSources: project.fundingSources?.length || 0,
			teamMembers: project.teamMembers?.length || 0,
		}));

		// Prepare report data
		const reportData = {
			foundation: {
				id: foundation._id,
				name: foundation.name,
				currency: foundation.currency,
			},
			filter: {
				status,
				category,
				health,
			},
			summary: {
				totalProjects: totalStats.count,
				totalBudget: totalStats.totalBudget,
				totalSpent: totalStats.totalSpent,
				totalRemaining: totalStats.totalRemaining,
				budgetUtilization,
				averageBudget: totalStats.averageBudget,
				averageDuration: totalStats.averageDuration,
				beneficiaries: {
					target: beneficiaryStats.totalTarget,
					reached: beneficiaryStats.totalReached,
					reachRate:
						beneficiaryStats.totalTarget > 0
							? (beneficiaryStats.totalReached / beneficiaryStats.totalTarget) *
							  100
							: 0,
				},
			},
			breakdowns: {
				byStatus: byStatus.map((item) => ({
					status: item._id,
					count: item.count,
					totalBudget: item.totalBudget,
					totalSpent: item.totalSpent,
					averageProgress: item.averageProgress,
					utilization:
						item.totalBudget > 0
							? (item.totalSpent / item.totalBudget) * 100
							: 0,
				})),
				byCategory: byCategory.map((item) => ({
					category: item._id,
					count: item.count,
					totalBudget: item.totalBudget,
					totalSpent: item.totalSpent,
					averageProgress: item.averageProgress,
				})),
				byHealth: byHealth.map((item) => ({
					health: item._id,
					count: item.count,
					totalBudget: item.totalBudget,
					totalSpent: item.totalSpent,
					averageProgress: item.averageProgress,
				})),
				fundingSources: fundingSources.map((item) => ({
					source: item._id,
					amount: item.totalAmount,
					committed: item.totalCommitted,
					received: item.totalReceived,
					percentage:
						totalStats.totalBudget > 0
							? (item.totalAmount / totalStats.totalBudget) * 100
							: 0,
				})),
			},
			projects: projectDetails,
			beneficiaryDetails,
			generatedAt: new Date(),
		};

		// Handle different output formats
		if (format === 'pdf') {
			return generateProjectPDF(res, reportData);
		} else if (format === 'excel') {
			return generateProjectExcel(res, reportData);
		} else if (format === 'csv') {
			return generateProjectCSV(res, reportData);
		}

		// Default JSON response
		res.json({
			success: true,
			message: 'Project report generated successfully',
			report: reportData,
		});
	} catch (error) {
		console.error('Project Report Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to generate project report',
			error: error.message,
		});
	}
});

// GET /api/reports/beneficiaries - Generate beneficiary report
router.get('/beneficiaries', auth, async (req, res) => {
	try {
		const {
			foundationId,
			projectId,
			gender,
			ageFrom,
			ageTo,
			enrollmentStatus,
			format = 'json',
			page = 1,
			limit = 100,
		} = req.query;

		if (!foundationId) {
			return res.status(400).json({
				success: false,
				message: 'Foundation ID is required',
			});
		}

		const foundation = await Foundation.findById(foundationId);
		if (!foundation) {
			return res.status(404).json({
				success: false,
				message: 'Foundation not found',
			});
		}

		const pageNum = parseInt(page);
		const limitNum = parseInt(limit);
		const skip = (pageNum - 1) * limitNum;

		// Build filter
		const filter = { foundationId, isActive: true };
		if (projectId) filter.projectId = projectId;
		if (gender) filter.gender = gender;
		if (enrollmentStatus) filter['enrollment.status'] = enrollmentStatus;

		// Age filter
		if (ageFrom || ageTo) {
			filter.age = {};
			if (ageFrom) filter.age.$gte = parseInt(ageFrom);
			if (ageTo) filter.age.$lte = parseInt(ageTo);
		}

		// Get beneficiaries with pagination
		const [beneficiaries, total] = await Promise.all([
			Beneficiary.find(filter)
				.populate('projectId', 'title')
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limitNum),
			Beneficiary.countDocuments(filter),
		]);

		// Get aggregate statistics
		const aggregates = await Beneficiary.aggregate([
			{
				$match: filter,
			},
			{
				$facet: {
					// Total statistics
					totalStats: [
						{
							$group: {
								_id: null,
								count: { $sum: 1 },
								averageAge: { $avg: '$age' },
								minAge: { $min: '$age' },
								maxAge: { $max: '$age' },
								totalSupport: { $sum: '$support.totalReceived' },
							},
						},
					],
					// By gender
					byGender: [
						{
							$group: {
								_id: '$gender',
								count: { $sum: 1 },
								averageAge: { $avg: '$age' },
								totalSupport: { $sum: '$support.totalReceived' },
							},
						},
					],
					// By age group
					byAgeGroup: [
						{
							$bucket: {
								groupBy: '$age',
								boundaries: [0, 18, 30, 45, 60, 100],
								default: 'Other',
								output: {
									count: { $sum: 1 },
									averageAge: { $avg: '$age' },
									totalSupport: { $sum: '$support.totalReceived' },
								},
							},
						},
					],
					// By marital status
					byMaritalStatus: [
						{
							$group: {
								_id: '$maritalStatus',
								count: { $sum: 1 },
								averageAge: { $avg: '$age' },
							},
						},
					],
					// By education level
					byEducation: [
						{
							$group: {
								_id: '$education.level',
								count: { $sum: 1 },
							},
						},
					],
					// By employment status
					byEmployment: [
						{
							$group: {
								_id: '$employment.status',
								count: { $sum: 1 },
							},
						},
					],
					// By enrollment status
					byEnrollment: [
						{
							$group: {
								_id: '$enrollment.status',
								count: { $sum: 1 },
								averageSupport: { $avg: '$support.totalReceived' },
							},
						},
					],
					// By project
					byProject: [
						{
							$match: { projectId: { $ne: null } },
						},
						{
							$lookup: {
								from: 'projects',
								localField: 'projectId',
								foreignField: '_id',
								as: 'project',
							},
						},
						{
							$unwind: '$project',
						},
						{
							$group: {
								_id: '$project.title',
								count: { $sum: 1 },
								averageAge: { $avg: '$age' },
								totalSupport: { $sum: '$support.totalReceived' },
							},
						},
						{
							$sort: { count: -1 },
						},
					],
					// By vulnerability score
					byVulnerability: [
						{
							$bucket: {
								groupBy: '$assessment.vulnerabilityScore',
								boundaries: [0, 30, 60, 80, 100],
								default: 'Not Assessed',
								output: {
									count: { $sum: 1 },
									averageScore: { $avg: '$assessment.vulnerabilityScore' },
								},
							},
						},
					],
					// Household income distribution
					byIncome: [
						{
							$bucket: {
								groupBy: '$household.monthlyIncome',
								boundaries: [0, 10000, 30000, 50000, 100000, 500000],
								default: 'Not Specified',
								output: {
									count: { $sum: 1 },
									averageIncome: { $avg: '$household.monthlyIncome' },
								},
							},
						},
					],
				},
			},
		]);

		const totalStats = aggregates[0].totalStats[0] || {
			count: 0,
			averageAge: 0,
			minAge: 0,
			maxAge: 0,
			totalSupport: 0,
		};
		const byGender = aggregates[0].byGender || [];
		const byAgeGroup = aggregates[0].byAgeGroup || [];
		const byMaritalStatus = aggregates[0].byMaritalStatus || [];
		const byEducation = aggregates[0].byEducation || [];
		const byEmployment = aggregates[0].byEmployment || [];
		const byEnrollment = aggregates[0].byEnrollment || [];
		const byProject = aggregates[0].byProject || [];
		const byVulnerability = aggregates[0].byVulnerability || [];
		const byIncome = aggregates[0].byIncome || [];

		// Prepare beneficiary details
		const beneficiaryDetails = beneficiaries.map((beneficiary) => ({
			id: beneficiary._id,
			beneficiaryId: beneficiary.beneficiaryId,
			fullName: `${beneficiary.firstName} ${beneficiary.lastName}`,
			gender: beneficiary.gender,
			age: beneficiary.age,
			dateOfBirth: beneficiary.dateOfBirth,
			contact: {
				phone: beneficiary.contact?.phone,
				address:
					beneficiary.contact?.address?.city ||
					beneficiary.contact?.address?.state,
			},
			maritalStatus: beneficiary.maritalStatus,
			education: beneficiary.education?.level,
			employment: beneficiary.employment?.status,
			household: {
				size: beneficiary.household?.size,
				incomeLevel: beneficiary.household?.incomeLevel,
				monthlyIncome: beneficiary.household?.monthlyIncome,
			},
			enrollment: {
				status: beneficiary.enrollment?.status,
				date: beneficiary.enrollment?.date,
				programType: beneficiary.enrollment?.programType,
			},
			support: {
				type: beneficiary.support?.type,
				totalReceived: beneficiary.support?.totalReceived,
				lastDisbursement: beneficiary.support?.lastDisbursement,
			},
			assessment: {
				vulnerabilityScore: beneficiary.assessment?.vulnerabilityScore,
				needs: beneficiary.assessment?.needs?.slice(0, 3),
			},
			project: beneficiary.projectId?.title,
			registeredDate: beneficiary.createdAt,
		}));

		// Prepare report data
		const reportData = {
			foundation: {
				id: foundation._id,
				name: foundation.name,
				currency: foundation.currency,
			},
			filter: {
				projectId,
				gender,
				ageFrom,
				ageTo,
				enrollmentStatus,
			},
			pagination: {
				currentPage: pageNum,
				totalPages: Math.ceil(total / limitNum),
				totalItems: total,
				itemsPerPage: limitNum,
			},
			summary: {
				totalBeneficiaries: totalStats.count,
				averageAge: totalStats.averageAge,
				ageRange: {
					min: totalStats.minAge,
					max: totalStats.maxAge,
				},
				totalSupportProvided: totalStats.totalSupport,
				averageSupport:
					totalStats.count > 0 ? totalStats.totalSupport / totalStats.count : 0,
			},
			demographics: {
				byGender: byGender.map((item) => ({
					gender: item._id,
					count: item.count,
					percentage: (item.count / totalStats.count) * 100,
					averageAge: item.averageAge,
					totalSupport: item.totalSupport,
				})),
				byAgeGroup: byAgeGroup.map((item) => ({
					ageGroup: item._id,
					count: item.count,
					percentage: (item.count / totalStats.count) * 100,
					averageAge: item.averageAge,
					totalSupport: item.totalSupport,
				})),
				byMaritalStatus: byMaritalStatus.map((item) => ({
					status: item._id,
					count: item.count,
					percentage: (item.count / totalStats.count) * 100,
					averageAge: item.averageAge,
				})),
			},
			socioEconomic: {
				byEducation: byEducation.map((item) => ({
					level: item._id,
					count: item.count,
					percentage: (item.count / totalStats.count) * 100,
				})),
				byEmployment: byEmployment.map((item) => ({
					status: item._id,
					count: item.count,
					percentage: (item.count / totalStats.count) * 100,
				})),
				byIncome: byIncome.map((item) => ({
					incomeRange: item._id,
					count: item.count,
					percentage: (item.count / totalStats.count) * 100,
					averageIncome: item.averageIncome,
				})),
			},
			programParticipation: {
				byEnrollment: byEnrollment.map((item) => ({
					status: item._id,
					count: item.count,
					percentage: (item.count / totalStats.count) * 100,
					averageSupport: item.averageSupport,
				})),
				byProject: byProject.map((item) => ({
					project: item._id,
					count: item.count,
					percentage: (item.count / totalStats.count) * 100,
					averageAge: item.averageAge,
					totalSupport: item.totalSupport,
				})),
			},
			vulnerability: {
				byVulnerability: byVulnerability.map((item) => ({
					scoreRange: item._id,
					count: item.count,
					percentage: (item.count / totalStats.count) * 100,
					averageScore: item.averageScore,
				})),
			},
			beneficiaries: beneficiaryDetails,
			generatedAt: new Date(),
		};

		// Handle different output formats
		if (format === 'pdf') {
			return generateBeneficiaryPDF(res, reportData);
		} else if (format === 'excel') {
			return generateBeneficiaryExcel(res, reportData);
		} else if (format === 'csv') {
			return generateBeneficiaryCSV(res, reportData);
		}

		// Default JSON response
		res.json({
			success: true,
			message: 'Beneficiary report generated successfully',
			report: reportData,
		});
	} catch (error) {
		console.error('Beneficiary Report Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to generate beneficiary report',
			error: error.message,
		});
	}
});

// GET /api/reports/tax - Generate tax compliance report
router.get('/tax', auth, async (req, res) => {
	try {
		const { foundationId, fiscalYear, format = 'json' } = req.query;

		if (!foundationId) {
			return res.status(400).json({
				success: false,
				message: 'Foundation ID is required',
			});
		}

		const foundation = await Foundation.findById(foundationId);
		if (!foundation) {
			return res.status(404).json({
				success: false,
				message: 'Foundation not found',
			});
		}

		// Determine fiscal year
		const currentYear = new Date().getFullYear();
		const year = fiscalYear ? parseInt(fiscalYear) : currentYear;
		const fiscalYearStart = new Date(
			year,
			foundation.financialYear.startMonth - 1,
			1
		);
		const fiscalYearEnd = new Date(
			year,
			foundation.financialYear.endMonth,
			0,
			23,
			59,
			59,
			999
		);

		// Get tax-deductible donations
		const donations = await Donation.find({
			foundationId,
			donationDate: { $gte: fiscalYearStart, $lte: fiscalYearEnd },
			status: 'received',
			taxDeductible: true,
		}).sort({ donationDate: -1 });

		// Get expenses with tax
		const expenses = await FoundationExpense.find({
			foundationId,
			paymentDate: { $gte: fiscalYearStart, $lte: fiscalYearEnd },
			status: 'paid',
			taxAmount: { $gt: 0 },
		}).sort({ paymentDate: -1 });

		// Get invoices with tax
		const invoices = await FoundationInvoice.find({
			foundationId,
			issueDate: { $gte: fiscalYearStart, $lte: fiscalYearEnd },
			'tax.amount': { $gt: 0 },
		}).sort({ issueDate: -1 });

		// Calculate tax summary
		const taxSummary = {
			fiscalYear: year,
			period: {
				start: fiscalYearStart,
				end: fiscalYearEnd,
			},
			donations: {
				totalAmount: donations.reduce((sum, d) => sum + d.amount, 0),
				count: donations.length,
				taxReceiptsIssued: donations.filter((d) => d.taxReceiptIssued).length,
				taxReceiptsPending: donations.filter((d) => !d.taxReceiptIssued).length,
				totalTaxReceiptAmount: donations
					.filter((d) => d.taxReceiptIssued)
					.reduce((sum, d) => sum + d.amount, 0),
			},
			expenses: {
				totalAmount: expenses.reduce((sum, e) => sum + e.totalAmount, 0),
				taxAmount: expenses.reduce((sum, e) => sum + e.taxAmount, 0),
				count: expenses.length,
			},
			invoices: {
				totalAmount: invoices.reduce((sum, i) => sum + i.totalAmount, 0),
				taxAmount: invoices.reduce((sum, i) => sum + i.tax.amount, 0),
				count: invoices.length,
			},
			taxPayable:
				expenses.reduce((sum, e) => sum + e.taxAmount, 0) -
				invoices.reduce((sum, i) => sum + i.tax.amount, 0),
		};

		// Tax compliance checklist
		const complianceChecklist = {
			registration: {
				status: foundation.registrationNumber ? 'completed' : 'pending',
				document: foundation.registrationNumber,
			},
			taxId: {
				status: foundation.taxId ? 'completed' : 'pending',
				document: foundation.taxId,
			},
			annualReturn: {
				status: 'pending', // This would be determined by actual submission
				dueDate: new Date(year + 1, 2, 31), // Example: March 31 of next year
				submitted: false,
			},
			auditedAccounts: {
				status: 'pending',
				dueDate: new Date(year + 1, 5, 30), // Example: June 30 of next year
				submitted: false,
			},
			taxReceipts: {
				status:
					taxSummary.donations.taxReceiptsIssued > 0 ? 'partial' : 'pending',
				issued: taxSummary.donations.taxReceiptsIssued,
				pending: taxSummary.donations.taxReceiptsPending,
			},
			taxPayments: {
				status: taxSummary.taxPayable <= 0 ? 'up_to_date' : 'pending',
				amount: taxSummary.taxPayable,
				dueDate: new Date(year + 1, 3, 15), // Example: April 15 of next year
			},
		};

		// Tax-deductible donation details
		const donationDetails = donations.map((donation) => ({
			id: donation._id,
			donationId: donation.donationId,
			date: donation.donationDate,
			donorName: donation.anonymous ? 'Anonymous' : donation.donationName,
			amount: donation.amount,
			currency: donation.currency,
			taxReceipt: {
				issued: donation.taxReceiptIssued,
				number: donation.taxReceiptNumber,
				date: donation.taxReceiptDate,
			},
			acknowledgment: {
				sent: donation.acknowledged,
				method: donation.acknowledgmentMethod,
				date: donation.acknowledgmentDate,
			},
		}));

		// Expense tax details
		const expenseDetails = expenses.map((expense) => ({
			id: expense._id,
			expenseId: expense.expenseId,
			date: expense.paymentDate,
			description: expense.description,
			payeeName: expense.payeeName,
			amount: expense.amount,
			taxAmount: expense.taxAmount,
			totalAmount: expense.totalAmount,
			hasReceipt: expense.hasReceipt,
			receiptNumber: expense.receiptNumber,
		}));

		// Invoice tax details
		const invoiceDetails = invoices.map((invoice) => ({
			id: invoice._id,
			invoiceId: invoice.invoiceId,
			date: invoice.issueDate,
			to: invoice.invoiceTo?.name,
			amount: invoice.subtotal,
			taxAmount: invoice.tax.amount,
			totalAmount: invoice.totalAmount,
			status: invoice.status,
			paymentStatus: invoice.payment?.status,
		}));

		// Prepare report data
		const reportData = {
			foundation: {
				id: foundation._id,
				name: foundation.name,
				registrationNumber: foundation.registrationNumber,
				taxId: foundation.taxId,
				currency: foundation.currency,
				financialYear: {
					startMonth: foundation.financialYear.startMonth,
					endMonth: foundation.financialYear.endMonth,
				},
			},
			fiscalYear: year,
			taxSummary,
			complianceChecklist,
			donationDetails,
			expenseDetails,
			invoiceDetails,
			generatedAt: new Date(),
		};

		// Handle different output formats
		if (format === 'pdf') {
			return generateTaxPDF(res, reportData);
		} else if (format === 'excel') {
			return generateTaxExcel(res, reportData);
		} else if (format === 'csv') {
			return generateTaxCSV(res, reportData);
		}

		// Default JSON response
		res.json({
			success: true,
			message: 'Tax compliance report generated successfully',
			report: reportData,
		});
	} catch (error) {
		console.error('Tax Report Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to generate tax compliance report',
			error: error.message,
		});
	}
});

// Helper function to generate PDF for financial report
async function generateFinancialPDF(res, reportData) {
	try {
		const doc = new PDFDocument({ margin: 50 });

		// Set response headers
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader(
			'Content-Disposition',
			`attachment; filename=financial-report-${Date.now()}.pdf`
		);

		doc.pipe(res);

		// Header
		doc.fontSize(20).text('FINANCIAL REPORT', { align: 'center' });
		doc.moveDown();
		doc
			.fontSize(12)
			.text(`Foundation: ${reportData.foundation.name}`, { align: 'center' });
		doc.text(
			`Period: ${formatDate(reportData.period.start)} to ${formatDate(
				reportData.period.end
			)}`,
			{ align: 'center' }
		);
		doc.text(`Generated: ${formatDate(reportData.generatedAt)}`, {
			align: 'center',
		});
		doc.moveDown();

		// Summary Section
		doc.fontSize(16).text('FINANCIAL SUMMARY', { underline: true });
		doc.moveDown();

		const summaryTable = {
			headers: ['Metric', 'Amount'],
			rows: [
				[
					'Total Revenue',
					formatCurrency(
						reportData.summary.totalRevenue,
						reportData.foundation.currency
					),
				],
				[
					'Total Expenses',
					formatCurrency(
						reportData.summary.totalExpenses,
						reportData.foundation.currency
					),
				],
				[
					'Net Income',
					formatCurrency(
						reportData.summary.netIncome,
						reportData.foundation.currency
					),
				],
				[
					'Total Donations',
					formatCurrency(
						reportData.summary.donationAmount,
						reportData.foundation.currency
					),
				],
				[
					'Total Grants',
					formatCurrency(
						reportData.summary.grantAmount,
						reportData.foundation.currency
					),
				],
			],
		};

		drawTable(doc, summaryTable, 50);
		doc.moveDown(2);

		// Financial Ratios
		doc.fontSize(16).text('FINANCIAL RATIOS', { underline: true });
		doc.moveDown();

		const ratiosTable = {
			headers: ['Ratio', 'Value', 'Status'],
			rows: [
				[
					'Program Efficiency',
					`${reportData.financialRatios.programEfficiency.toFixed(2)}%`,
					getStatusText(reportData.financialRatios.programEfficiency, 65),
				],
				[
					'Fundraising Efficiency',
					`${reportData.financialRatios.fundraisingEfficiency.toFixed(2)}%`,
					getStatusText(
						reportData.financialRatios.fundraisingEfficiency,
						35,
						true
					),
				],
				[
					'Administrative Ratio',
					`${reportData.financialRatios.administrativeRatio.toFixed(2)}%`,
					getStatusText(
						reportData.financialRatios.administrativeRatio,
						35,
						true
					),
				],
				[
					'Net Profit Margin',
					`${reportData.financialRatios.netProfitMargin.toFixed(2)}%`,
					getStatusText(reportData.financialRatios.netProfitMargin, 10),
				],
			],
		};

		drawTable(doc, ratiosTable, 50);

		doc.end();
	} catch (error) {
		console.error('PDF Generation Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to generate PDF report',
			error: error.message,
		});
	}
}

// Helper function to generate Excel for financial report
async function generateFinancialExcel(res, reportData) {
	try {
		const workbook = new ExcelJS.Workbook();
		const worksheet = workbook.addWorksheet('Financial Report');

		// Add headers
		worksheet.columns = [
			{ header: 'Metric', key: 'metric', width: 30 },
			{ header: 'Value', key: 'value', width: 20 },
			{ header: 'Currency', key: 'currency', width: 15 },
		];

		// Add foundation info
		worksheet.addRow(['Foundation:', reportData.foundation.name]);
		worksheet.addRow([
			'Period:',
			`${formatDate(reportData.period.start)} to ${formatDate(
				reportData.period.end
			)}`,
		]);
		worksheet.addRow(['Generated:', formatDate(reportData.generatedAt)]);
		worksheet.addRow([]);

		// Add summary
		worksheet.addRow(['FINANCIAL SUMMARY']);
		worksheet.addRow([
			'Total Revenue',
			reportData.summary.totalRevenue,
			reportData.foundation.currency,
		]);
		worksheet.addRow([
			'Total Expenses',
			reportData.summary.totalExpenses,
			reportData.foundation.currency,
		]);
		worksheet.addRow([
			'Net Income',
			reportData.summary.netIncome,
			reportData.foundation.currency,
		]);
		worksheet.addRow([
			'Total Donations',
			reportData.summary.donationAmount,
			reportData.foundation.currency,
		]);
		worksheet.addRow([
			'Total Grants',
			reportData.summary.grantAmount,
			reportData.foundation.currency,
		]);
		worksheet.addRow([]);

		// Add ratios
		worksheet.addRow(['FINANCIAL RATIOS']);
		worksheet.addRow([
			'Program Efficiency',
			`${reportData.financialRatios.programEfficiency.toFixed(2)}%`,
		]);
		worksheet.addRow([
			'Fundraising Efficiency',
			`${reportData.financialRatios.fundraisingEfficiency.toFixed(2)}%`,
		]);
		worksheet.addRow([
			'Administrative Ratio',
			`${reportData.financialRatios.administrativeRatio.toFixed(2)}%`,
		]);
		worksheet.addRow([
			'Net Profit Margin',
			`${reportData.financialRatios.netProfitMargin.toFixed(2)}%`,
		]);

		// Set response headers
		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		);
		res.setHeader(
			'Content-Disposition',
			`attachment; filename=financial-report-${Date.now()}.xlsx`
		);

		await workbook.xlsx.write(res);
		res.end();
	} catch (error) {
		console.error('Excel Generation Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to generate Excel report',
			error: error.message,
		});
	}
}

// Helper function to generate CSV for financial report
async function generateFinancialCSV(res, reportData) {
	try {
		const csvRows = [];

		// Add headers
		csvRows.push(['Foundation:', reportData.foundation.name]);
		csvRows.push([
			'Period:',
			`${formatDate(reportData.period.start)} to ${formatDate(
				reportData.period.end
			)}`,
		]);
		csvRows.push(['Generated:', formatDate(reportData.generatedAt)]);
		csvRows.push([]);

		// Add summary
		csvRows.push(['FINANCIAL SUMMARY']);
		csvRows.push(['Metric', 'Amount', 'Currency']);
		csvRows.push([
			'Total Revenue',
			reportData.summary.totalRevenue,
			reportData.foundation.currency,
		]);
		csvRows.push([
			'Total Expenses',
			reportData.summary.totalExpenses,
			reportData.foundation.currency,
		]);
		csvRows.push([
			'Net Income',
			reportData.summary.netIncome,
			reportData.foundation.currency,
		]);
		csvRows.push([
			'Total Donations',
			reportData.summary.donationAmount,
			reportData.foundation.currency,
		]);
		csvRows.push([
			'Total Grants',
			reportData.summary.grantAmount,
			reportData.foundation.currency,
		]);
		csvRows.push([]);

		// Add ratios
		csvRows.push(['FINANCIAL RATIOS']);
		csvRows.push(['Ratio', 'Value']);
		csvRows.push([
			'Program Efficiency',
			`${reportData.financialRatios.programEfficiency.toFixed(2)}%`,
		]);
		csvRows.push([
			'Fundraising Efficiency',
			`${reportData.financialRatios.fundraisingEfficiency.toFixed(2)}%`,
		]);
		csvRows.push([
			'Administrative Ratio',
			`${reportData.financialRatios.administrativeRatio.toFixed(2)}%`,
		]);
		csvRows.push([
			'Net Profit Margin',
			`${reportData.financialRatios.netProfitMargin.toFixed(2)}%`,
		]);

		const csvContent = csvRows.map((row) => row.join(',')).join('\n');

		// Set response headers
		res.setHeader('Content-Type', 'text/csv');
		res.setHeader(
			'Content-Disposition',
			`attachment; filename=financial-report-${Date.now()}.csv`
		);

		res.send(csvContent);
	} catch (error) {
		console.error('CSV Generation Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to generate CSV report',
			error: error.message,
		});
	}
}

// Similar functions for other report types (donation, expense, project, beneficiary, tax)
// These would follow the same pattern but with different data structures

// Helper function to draw table in PDF
function drawTable(doc, table, startX) {
	const columnWidth = 150;
	const rowHeight = 20;
	const startY = doc.y;

	// Draw headers
	doc.fontSize(10).font('Helvetica-Bold');
	table.headers.forEach((header, i) => {
		doc.text(header, startX + i * columnWidth, startY, { width: columnWidth });
	});

	// Draw rows
	doc.font('Helvetica');
	table.rows.forEach((row, rowIndex) => {
		const y = startY + (rowIndex + 1) * rowHeight;
		row.forEach((cell, colIndex) => {
			doc.text(cell.toString(), startX + colIndex * columnWidth, y, {
				width: columnWidth,
			});
		});
	});

	doc.moveDown(table.rows.length);
}

// Helper function to get status text for ratios
function getStatusText(value, target, reverse = false) {
	if (reverse) {
		if (value <= target) return 'Good';
		if (value <= target * 1.5) return 'Warning';
		return 'Critical';
	} else {
		if (value >= target) return 'Good';
		if (value >= target * 0.7) return 'Warning';
		return 'Critical';
	}
}

// Placeholder functions for other report types
async function generateDonationPDF(res, reportData) {
	// Implementation similar to generateFinancialPDF
	res.json({ message: 'PDF generation for donation report' });
}

async function generateDonationExcel(res, reportData) {
	// Implementation similar to generateFinancialExcel
	res.json({ message: 'Excel generation for donation report' });
}

async function generateDonationCSV(res, reportData) {
	// Implementation similar to generateFinancialCSV
	res.json({ message: 'CSV generation for donation report' });
}

async function generateExpensePDF(res, reportData) {
	// Implementation similar to generateFinancialPDF
	res.json({ message: 'PDF generation for expense report' });
}

async function generateExpenseExcel(res, reportData) {
	// Implementation similar to generateFinancialExcel
	res.json({ message: 'Excel generation for expense report' });
}

async function generateExpenseCSV(res, reportData) {
	// Implementation similar to generateFinancialCSV
	res.json({ message: 'CSV generation for expense report' });
}

async function generateProjectPDF(res, reportData) {
	// Implementation similar to generateFinancialPDF
	res.json({ message: 'PDF generation for project report' });
}

async function generateProjectExcel(res, reportData) {
	// Implementation similar to generateFinancialExcel
	res.json({ message: 'Excel generation for project report' });
}

async function generateProjectCSV(res, reportData) {
	// Implementation similar to generateFinancialCSV
	res.json({ message: 'CSV generation for project report' });
}

async function generateBeneficiaryPDF(res, reportData) {
	// Implementation similar to generateFinancialPDF
	res.json({ message: 'PDF generation for beneficiary report' });
}

async function generateBeneficiaryExcel(res, reportData) {
	// Implementation similar to generateFinancialExcel
	res.json({ message: 'Excel generation for beneficiary report' });
}

async function generateBeneficiaryCSV(res, reportData) {
	// Implementation similar to generateFinancialCSV
	res.json({ message: 'CSV generation for beneficiary report' });
}

async function generateTaxPDF(res, reportData) {
	// Implementation similar to generateFinancialPDF
	res.json({ message: 'PDF generation for tax report' });
}

async function generateTaxExcel(res, reportData) {
	// Implementation similar to generateFinancialExcel
	res.json({ message: 'Excel generation for tax report' });
}

async function generateTaxCSV(res, reportData) {
	// Implementation similar to generateFinancialCSV
	res.json({ message: 'CSV generation for tax report' });
}

export default router;
