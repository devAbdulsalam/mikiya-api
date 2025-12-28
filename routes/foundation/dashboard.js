import express from 'express';
import mongoose from 'mongoose';
import Foundation from '../../models/Foundation.js';
import Fund from '../../models/Fund.js';
import Donation from '../../models/Donation.js';
import Grant from '../../models/Grant.js';
import FoundationExpense from '../../models/FoundationExpense.js';
import Project from '../../models/Project.js';
import Beneficiary from '../../models/Beneficiary.js';
import CashFlow from '../../models/CashFlow.js';
import { auth } from '../../middlewares/auth.js';

const router = express.Router();

// GET /api/dashboard/overview - Get foundation dashboard overview
router.get('/overview', auth, async (req, res) => {
	try {
		const { foundationId } = req.query;

		if (!foundationId) {
			return res.status(400).json({
				success: false,
				message: 'Foundation ID is required',
			});
		}

		// Get foundation details
		const foundation = await Foundation.findById(foundationId);
		if (!foundation) {
			return res.status(404).json({
				success: false,
				message: 'Foundation not found',
			});
		}

		// Get current date and calculate date ranges
		const now = new Date();
		const currentMonth = now.getMonth();
		const currentYear = now.getFullYear();
		const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
		const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

		const currentMonthStart = new Date(currentYear, currentMonth, 1);
		const currentMonthEnd = new Date(
			currentYear,
			currentMonth + 1,
			0,
			23,
			59,
			59,
			999
		);

		const lastMonthStart = new Date(lastMonthYear, lastMonth, 1);
		const lastMonthEnd = new Date(
			lastMonthYear,
			lastMonth + 1,
			0,
			23,
			59,
			59,
			999
		);

		const currentYearStart = new Date(currentYear, 0, 1);
		const currentYearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);

		// Get funds summary
		const funds = await Fund.find({ foundationId });

		// Get recent donations (last 30 days)
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const recentDonations = await Donation.find({
			foundationId,
			donationDate: { $gte: thirtyDaysAgo },
			status: 'received',
		})
			.sort({ donationDate: -1 })
			.limit(10);

		// Get recent grants
		const recentGrants = await Grant.find({
			foundationId,
			status: 'active',
		})
			.sort({ startDate: -1 })
			.limit(10);

		// Get recent expenses
		const recentExpenses = await FoundationExpense.find({
			foundationId,
			status: 'paid',
		})
			.sort({ paymentDate: -1 })
			.limit(10);

		// Get active projects
		const activeProjects = await Project.find({
			foundationId,
			status: 'active',
		})
			.sort({ startDate: -1 })
			.limit(5);

		// Get cash flow for current month
		const currentMonthCashFlow = await CashFlow.findOne({
			foundationId,
			period: 'monthly',
			periodDate: {
				$gte: currentMonthStart,
				$lte: currentMonthEnd,
			},
		});

		// Calculate financial metrics
		const totalFundsBalance = funds.reduce(
			(sum, fund) => sum + fund.currentBalance,
			0
		);
		const totalAllocated = funds.reduce(
			(sum, fund) => sum + fund.allocatedAmount,
			0
		);
		const totalAvailable = funds.reduce(
			(sum, fund) => sum + fund.availableBalance,
			0
		);

		// Get donations this month
		const donationsThisMonth = await Donation.aggregate([
			{
				$match: {
					foundationId: mongoose.Types.ObjectId(foundationId),
					donationDate: { $gte: currentMonthStart, $lte: currentMonthEnd },
					status: 'received',
				},
			},
			{
				$group: {
					_id: null,
					totalAmount: { $sum: '$amount' },
					count: { $sum: 1 },
				},
			},
		]);

		// Get expenses this month
		const expensesThisMonth = await FoundationExpense.aggregate([
			{
				$match: {
					foundationId: mongoose.Types.ObjectId(foundationId),
					paymentDate: { $gte: currentMonthStart, $lte: currentMonthEnd },
					status: 'paid',
				},
			},
			{
				$group: {
					_id: null,
					totalAmount: { $sum: '$totalAmount' },
					count: { $sum: 1 },
				},
			},
		]);

		// Get donations last month for comparison
		const donationsLastMonth = await Donation.aggregate([
			{
				$match: {
					foundationId: mongoose.Types.ObjectId(foundationId),
					donationDate: { $gte: lastMonthStart, $lte: lastMonthEnd },
					status: 'received',
				},
			},
			{
				$group: {
					_id: null,
					totalAmount: { $sum: '$amount' },
				},
			},
		]);

		// Calculate percentage changes
		const currentMonthDonations = donationsThisMonth[0]?.totalAmount || 0;
		const lastMonthDonations = donationsLastMonth[0]?.totalAmount || 0;
		const donationChange =
			lastMonthDonations === 0
				? 0
				: ((currentMonthDonations - lastMonthDonations) / lastMonthDonations) *
				  100;

		// Get expense categories breakdown
		const expenseCategories = await FoundationExpense.aggregate([
			{
				$match: {
					foundationId: mongoose.Types.ObjectId(foundationId),
					paymentDate: { $gte: currentMonthStart, $lte: currentMonthEnd },
					status: 'paid',
				},
			},
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
		]);

		// Get fund performance
		const fundPerformance = await Fund.aggregate([
			{
				$match: { foundationId: mongoose.Types.ObjectId(foundationId) },
			},
			{
				$project: {
					name: 1,
					currentBalance: 1,
					targetAmount: 1,
					targetAchievement: {
						$cond: {
							if: { $eq: ['$targetAmount', 0] },
							then: 0,
							else: {
								$multiply: [
									{ $divide: ['$currentBalance', '$targetAmount'] },
									100,
								],
							},
						},
					},
					utilizationRate: '$performance.utilizationRate',
					status: 1,
				},
			},
			{
				$sort: { currentBalance: -1 },
			},
		]);

		// Get upcoming payments
		const upcomingPayments = await FoundationExpense.find({
			foundationId,
			dueDate: {
				$gte: new Date(),
				$lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			},
			status: { $in: ['approved', 'submitted'] },
		})
			.sort({ dueDate: 1 })
			.limit(10);

		// Get project health status
		const projectHealth = await Project.aggregate([
			{
				$match: {
					foundationId: mongoose.Types.ObjectId(foundationId),
					status: 'active',
				},
			},
			{
				$group: {
					_id: '$health',
					count: { $sum: 1 },
				},
			},
		]);

		// Get beneficiary demographics
		const beneficiaryDemographics = await Beneficiary.aggregate([
			{
				$match: {
					foundationId: mongoose.Types.ObjectId(foundationId),
					isActive: true,
				},
			},
			{
				$group: {
					_id: '$gender',
					count: { $sum: 1 },
					averageAge: { $avg: '$age' },
				},
			},
		]);

		// Prepare dashboard data
		const dashboardData = {
			foundation: {
				id: foundation._id,
				name: foundation.name,
				registrationNumber: foundation.registrationNumber,
				status: foundation.status,
				currency: foundation.currency,
			},
			overview: {
				totalFunds: funds.length,
				totalBalance: totalFundsBalance,
				allocatedAmount: totalAllocated,
				availableBalance: totalAvailable,
				activeProjects: activeProjects.length,
				totalBeneficiaries: foundation.statistics.totalBeneficiaries,
			},
			financial: {
				currentMonth: {
					donations: {
						amount: currentMonthDonations,
						count: donationsThisMonth[0]?.count || 0,
						change: donationChange.toFixed(2),
					},
					expenses: {
						amount: expensesThisMonth[0]?.totalAmount || 0,
						count: expensesThisMonth[0]?.count || 0,
					},
					netCashFlow:
						currentMonthDonations - (expensesThisMonth[0]?.totalAmount || 0),
				},
				yearToDate: {
					donations: foundation.statistics.totalDonations.amount,
					expenses: foundation.statistics.totalExpenses.amount,
					grants: foundation.statistics.totalGrants.amount,
				},
				cashFlow: currentMonthCashFlow || null,
			},
			funds: {
				summary: fundPerformance,
				topFunds: fundPerformance.slice(0, 5),
			},
			expenses: {
				categories: expenseCategories,
				upcoming: upcomingPayments,
			},
			projects: {
				active: activeProjects,
				health: projectHealth,
			},
			beneficiaries: {
				demographics: beneficiaryDemographics,
				total: foundation.statistics.totalBeneficiaries,
			},
			recentActivity: {
				donations: recentDonations,
				grants: recentGrants,
				expenses: recentExpenses,
			},
			alerts: await generateAlerts(foundationId),
		};

		res.json({
			success: true,
			dashboard: dashboardData,
		});
	} catch (error) {
		console.error('Dashboard Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to load dashboard',
			error: error.message,
		});
	}
});

// Helper function to generate alerts
async function generateAlerts(foundationId) {
	const alerts = [];
	const now = new Date();

	// Check for low balance funds
	const lowBalanceFunds = await Fund.find({
		foundationId,
		currentBalance: { $lt: 10000 }, // Less than 10,000
		isActive: true,
	}).limit(5);

	lowBalanceFunds.forEach((fund) => {
		alerts.push({
			type: 'warning',
			title: 'Low Fund Balance',
			message: `${fund.name} has low balance: ${
				fund.currency
			} ${fund.currentBalance.toLocaleString()}`,
			entity: 'fund',
			entityId: fund._id,
			priority: 'medium',
			timestamp: new Date(),
		});
	});

	// Check for overdue invoices
	const overdueInvoices = await FoundationInvoice.find({
		foundationId,
		dueDate: { $lt: now },
		status: { $in: ['sent', 'viewed'] },
		'payment.status': { $in: ['pending', 'partial'] },
	}).limit(5);

	overdueInvoices.forEach((invoice) => {
		alerts.push({
			type: 'danger',
			title: 'Overdue Invoice',
			message: `Invoice ${invoice.invoiceId} is overdue by ${invoice.payment.balance} ${invoice.currency}`,
			entity: 'invoice',
			entityId: invoice._id,
			priority: 'high',
			timestamp: new Date(),
		});
	});

	// Check for projects at risk
	const atRiskProjects = await Project.find({
		foundationId,
		health: 'critical',
		status: 'active',
	}).limit(5);

	atRiskProjects.forEach((project) => {
		alerts.push({
			type: 'danger',
			title: 'Project at Risk',
			message: `${project.title} is at critical health status`,
			entity: 'project',
			entityId: project._id,
			priority: 'high',
			timestamp: new Date(),
		});
	});

	// Check for upcoming grant reporting deadlines
	const upcomingReports = await Grant.find({
		foundationId,
		'reportingRequirements.dueDate': {
			$gte: now,
			$lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
		},
		'reportingRequirements.submitted': false,
		status: 'active',
	}).limit(5);

	upcomingReports.forEach((grant) => {
		grant.reportingRequirements.forEach((req) => {
			if (
				!req.submitted &&
				req.dueDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
			) {
				alerts.push({
					type: 'warning',
					title: 'Upcoming Report Due',
					message: `${grant.title} has a ${
						req.reportType
					} due on ${req.dueDate.toLocaleDateString()}`,
					entity: 'grant',
					entityId: grant._id,
					priority: 'medium',
					timestamp: new Date(),
				});
			}
		});
	});

	return alerts;
}

// GET /api/dashboard/financial-summary - Get financial summary
router.get('/financial-summary', auth, async (req, res) => {
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

		// Get donations in period
		const donations = await Donation.aggregate([
			{
				$match: {
					foundationId: mongoose.Types.ObjectId(foundationId),
					donationDate: { $gte: start, $lte: end },
					status: 'received',
				},
			},
			{
				$group: {
					_id: {
						year: { $year: '$donationDate' },
						month: { $month: '$donationDate' },
					},
					totalAmount: { $sum: '$amount' },
					count: { $sum: 1 },
					averageAmount: { $avg: '$amount' },
				},
			},
			{
				$sort: { '_id.year': 1, '_id.month': 1 },
			},
		]);

		// Get expenses in period
		const expenses = await FoundationExpense.aggregate([
			{
				$match: {
					foundationId: mongoose.Types.ObjectId(foundationId),
					paymentDate: { $gte: start, $lte: end },
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
					averageAmount: { $avg: '$totalAmount' },
				},
			},
			{
				$sort: { '_id.year': 1, '_id.month': 1 },
			},
		]);

		// Get grants in period
		const grants = await Grant.aggregate([
			{
				$match: {
					foundationId: mongoose.Types.ObjectId(foundationId),
					approvalDate: { $gte: start, $lte: end },
					status: 'approved',
				},
			},
			{
				$group: {
					_id: {
						year: { $year: '$approvalDate' },
						month: { $month: '$approvalDate' },
					},
					totalAmount: { $sum: '$amount' },
					count: { $sum: 1 },
					averageAmount: { $avg: '$amount' },
				},
			},
			{
				$sort: { '_id.year': 1, '_id.month': 1 },
			},
		]);

		// Get fund balances over time
		const cashFlows = await CashFlow.find({
			foundationId,
			periodDate: { $gte: start, $lte: end },
			period: 'monthly',
		}).sort({ periodDate: 1 });

		// Prepare financial summary
		const financialSummary = {
			period: { start, end },
			donations: {
				monthly: donations,
				total: donations.reduce((sum, item) => sum + item.totalAmount, 0),
				count: donations.reduce((sum, item) => sum + item.count, 0),
				average:
					donations.length > 0
						? donations.reduce((sum, item) => sum + item.averageAmount, 0) /
						  donations.length
						: 0,
			},
			expenses: {
				monthly: expenses,
				total: expenses.reduce((sum, item) => sum + item.totalAmount, 0),
				count: expenses.reduce((sum, item) => sum + item.count, 0),
				average:
					expenses.length > 0
						? expenses.reduce((sum, item) => sum + item.averageAmount, 0) /
						  expenses.length
						: 0,
			},
			grants: {
				monthly: grants,
				total: grants.reduce((sum, item) => sum + item.totalAmount, 0),
				count: grants.reduce((sum, item) => sum + item.count, 0),
				average:
					grants.length > 0
						? grants.reduce((sum, item) => sum + item.averageAmount, 0) /
						  grants.length
						: 0,
			},
			cashFlows,
			netPosition: {
				totalInflows:
					donations.reduce((sum, item) => sum + item.totalAmount, 0) +
					grants.reduce((sum, item) => sum + item.totalAmount, 0),
				totalOutflows: expenses.reduce(
					(sum, item) => sum + item.totalAmount,
					0
				),
				netCashFlow:
					donations.reduce((sum, item) => sum + item.totalAmount, 0) +
					grants.reduce((sum, item) => sum + item.totalAmount, 0) -
					expenses.reduce((sum, item) => sum + item.totalAmount, 0),
			},
		};

		res.json({
			success: true,
			financialSummary,
		});
	} catch (error) {
		console.error('Financial Summary Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to load financial summary',
			error: error.message,
		});
	}
});

// GET /api/dashboard/performance - Get foundation performance metrics
router.get('/performance', auth, async (req, res) => {
	try {
		const { foundationId } = req.query;

		if (!foundationId) {
			return res.status(400).json({
				success: false,
				message: 'Foundation ID is required',
			});
		}

		// Get foundation
		const foundation = await Foundation.findById(foundationId);

		// Calculate efficiency metrics
		const efficiencyMetrics = await calculateEfficiencyMetrics(foundationId);

		// Calculate impact metrics
		const impactMetrics = await calculateImpactMetrics(foundationId);

		// Calculate financial health metrics
		const financialHealth = await calculateFinancialHealth(foundationId);

		// Get trend data
		const trends = await calculateTrends(foundationId);

		res.json({
			success: true,
			performance: {
				efficiency: efficiencyMetrics,
				impact: impactMetrics,
				financialHealth,
				trends,
				overallScore: calculateOverallScore(
					efficiencyMetrics,
					impactMetrics,
					financialHealth
				),
			},
		});
	} catch (error) {
		console.error('Performance Metrics Error:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to load performance metrics',
			error: error.message,
		});
	}
});

// Helper functions for performance metrics
async function calculateEfficiencyMetrics(foundationId) {
	const now = new Date();
	const yearStart = new Date(now.getFullYear(), 0, 1);

	// Get donations and expenses for current year
	const [donations, expenses] = await Promise.all([
		Donation.aggregate([
			{
				$match: {
					foundationId: mongoose.Types.ObjectId(foundationId),
					donationDate: { $gte: yearStart, $lte: now },
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
					paymentDate: { $gte: yearStart, $lte: now },
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

	const totalDonations = donations[0]?.totalAmount || 0;
	const totalExpenses = expenses[0]?.totalAmount || 0;

	// Calculate efficiency ratio (Program Expenses / Total Expenses)
	const programExpenses = await FoundationExpense.aggregate([
		{
			$match: {
				foundationId: mongoose.Types.ObjectId(foundationId),
				paymentDate: { $gte: yearStart, $lte: now },
				status: 'paid',
				expenseType: 'program',
			},
		},
		{
			$group: {
				_id: null,
				totalAmount: { $sum: '$totalAmount' },
			},
		},
	]);

	const totalProgramExpenses = programExpenses[0]?.totalAmount || 0;
	const efficiencyRatio =
		totalExpenses > 0 ? (totalProgramExpenses / totalExpenses) * 100 : 0;

	// Calculate fundraising efficiency (Fundraising Expenses / Donations)
	const fundraisingExpenses = await FoundationExpense.aggregate([
		{
			$match: {
				foundationId: mongoose.Types.ObjectId(foundationId),
				paymentDate: { $gte: yearStart, $lte: now },
				status: 'paid',
				expenseType: 'fundraising',
			},
		},
		{
			$group: {
				_id: null,
				totalAmount: { $sum: '$totalAmount' },
			},
		},
	]);

	const totalFundraisingExpenses = fundraisingExpenses[0]?.totalAmount || 0;
	const fundraisingEfficiency =
		totalDonations > 0 ? (totalFundraisingExpenses / totalDonations) * 100 : 0;

	return {
		efficiencyRatio: {
			value: efficiencyRatio,
			target: 65, // Industry standard: at least 65% should go to programs
			status:
				efficiencyRatio >= 65
					? 'good'
					: efficiencyRatio >= 50
					? 'warning'
					: 'critical',
		},
		fundraisingEfficiency: {
			value: fundraisingEfficiency,
			target: 35, // Industry standard: fundraising should be less than 35% of donations
			status:
				fundraisingEfficiency <= 35
					? 'good'
					: fundraisingEfficiency <= 50
					? 'warning'
					: 'critical',
		},
		administrativeRatio: {
			value: 100 - efficiencyRatio,
			target: 35,
			status:
				100 - efficiencyRatio <= 35
					? 'good'
					: 100 - efficiencyRatio <= 50
					? 'warning'
					: 'critical',
		},
	};
}

async function calculateImpactMetrics(foundationId) {
	// Get total beneficiaries
	const totalBeneficiaries = await Beneficiary.countDocuments({
		foundationId,
		isActive: true,
	});

	// Get projects and their outcomes
	const projects = await Project.find({ foundationId, status: 'active' });

	let totalImpactScore = 0;
	let projectsWithImpact = 0;

	projects.forEach((project) => {
		if (project.beneficiaries && project.beneficiaries.reached > 0) {
			const reachRatio =
				project.beneficiaries.target > 0
					? (project.beneficiaries.reached / project.beneficiaries.target) * 100
					: 0;
			totalImpactScore += reachRatio;
			projectsWithImpact++;
		}
	});

	const averageImpactScore =
		projectsWithImpact > 0 ? totalImpactScore / projectsWithImpact : 0;

	// Calculate project completion rate
	const totalProjects = await Project.countDocuments({ foundationId });
	const completedProjects = await Project.countDocuments({
		foundationId,
		status: 'completed',
	});

	const completionRate =
		totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;

	return {
		beneficiariesReached: {
			value: totalBeneficiaries,
			target: 1000, // Example target
			status:
				totalBeneficiaries >= 1000
					? 'excellent'
					: totalBeneficiaries >= 500
					? 'good'
					: 'needs_improvement',
		},
		averageImpactScore: {
			value: averageImpactScore,
			target: 80,
			status:
				averageImpactScore >= 80
					? 'excellent'
					: averageImpactScore >= 60
					? 'good'
					: 'needs_improvement',
		},
		projectCompletionRate: {
			value: completionRate,
			target: 90,
			status:
				completionRate >= 90
					? 'excellent'
					: completionRate >= 70
					? 'good'
					: 'needs_improvement',
		},
	};
}

async function calculateFinancialHealth(foundationId) {
	// Get current fund balances
	const funds = await Fund.find({ foundationId, isActive: true });
	const totalBalance = funds.reduce(
		(sum, fund) => sum + fund.currentBalance,
		0
	);

	// Calculate average monthly expenses
	const now = new Date();
	const sixMonthsAgo = new Date();
	sixMonthsAgo.setMonth(now.getMonth() - 6);

	const monthlyExpenses = await FoundationExpense.aggregate([
		{
			$match: {
				foundationId: mongoose.Types.ObjectId(foundationId),
				paymentDate: { $gte: sixMonthsAgo, $lte: now },
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
			},
		},
	]);

	const averageMonthlyExpenses =
		monthlyExpenses.length > 0
			? monthlyExpenses.reduce((sum, item) => sum + item.totalAmount, 0) /
			  monthlyExpenses.length
			: 0;

	// Calculate months of operation
	const monthsOfOperation =
		averageMonthlyExpenses > 0 ? totalBalance / averageMonthlyExpenses : 0;

	// Calculate debt ratio (if applicable)
	// For now, assume no debt
	const debtRatio = 0;

	// Calculate revenue growth
	const currentYearStart = new Date(now.getFullYear(), 0, 1);
	const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
	const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);

	const [currentYearDonations, lastYearDonations] = await Promise.all([
		Donation.aggregate([
			{
				$match: {
					foundationId: mongoose.Types.ObjectId(foundationId),
					donationDate: { $gte: currentYearStart, $lte: now },
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
		Donation.aggregate([
			{
				$match: {
					foundationId: mongoose.Types.ObjectId(foundationId),
					donationDate: { $gte: lastYearStart, $lte: lastYearEnd },
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
	]);

	const currentYearTotal = currentYearDonations[0]?.totalAmount || 0;
	const lastYearTotal = lastYearDonations[0]?.totalAmount || 0;

	const revenueGrowth =
		lastYearTotal > 0
			? ((currentYearTotal - lastYearTotal) / lastYearTotal) * 100
			: 0;

	return {
		monthsOfOperation: {
			value: monthsOfOperation,
			target: 6, // Minimum 6 months of operation
			status:
				monthsOfOperation >= 6
					? 'good'
					: monthsOfOperation >= 3
					? 'warning'
					: 'critical',
		},
		debtRatio: {
			value: debtRatio,
			target: 0,
			status:
				debtRatio === 0 ? 'good' : debtRatio <= 30 ? 'warning' : 'critical',
		},
		revenueGrowth: {
			value: revenueGrowth,
			target: 10, // Target 10% growth
			status:
				revenueGrowth >= 10
					? 'excellent'
					: revenueGrowth >= 0
					? 'good'
					: 'critical',
		},
		liquidity: {
			value: totalBalance,
			status:
				totalBalance >= 1000000
					? 'excellent'
					: totalBalance >= 500000
					? 'good'
					: 'warning',
		},
	};
}

async function calculateTrends(foundationId) {
	const now = new Date();
	const twelveMonthsAgo = new Date();
	twelveMonthsAgo.setMonth(now.getMonth() - 12);

	// Get monthly donations
	const monthlyDonations = await Donation.aggregate([
		{
			$match: {
				foundationId: mongoose.Types.ObjectId(foundationId),
				donationDate: { $gte: twelveMonthsAgo, $lte: now },
				status: 'received',
			},
		},
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
	]);

	// Get monthly expenses
	const monthlyExpenses = await FoundationExpense.aggregate([
		{
			$match: {
				foundationId: mongoose.Types.ObjectId(foundationId),
				paymentDate: { $gte: twelveMonthsAgo, $lte: now },
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

	// Get monthly beneficiary growth
	const monthlyBeneficiaries = await Beneficiary.aggregate([
		{
			$match: {
				foundationId: mongoose.Types.ObjectId(foundationId),
				createdAt: { $gte: twelveMonthsAgo, $lte: now },
			},
		},
		{
			$group: {
				_id: {
					year: { $year: '$createdAt' },
					month: { $month: '$createdAt' },
				},
				count: { $sum: 1 },
			},
		},
		{
			$sort: { '_id.year': 1, '_id.month': 1 },
		},
	]);

	return {
		donations: monthlyDonations,
		expenses: monthlyExpenses,
		beneficiaries: monthlyBeneficiaries,
	};
}

function calculateOverallScore(efficiency, impact, financial) {
	const weights = {
		efficiency: 0.3,
		impact: 0.4,
		financial: 0.3,
	};

	// Convert status to scores
	const statusScores = {
		excellent: 100,
		good: 80,
		warning: 60,
		needs_improvement: 40,
		critical: 20,
	};

	const efficiencyScore =
		statusScores[efficiency.efficiencyRatio.status] * 0.4 +
		statusScores[efficiency.fundraisingEfficiency.status] * 0.3 +
		statusScores[efficiency.administrativeRatio.status] * 0.3;

	const impactScore =
		statusScores[impact.beneficiariesReached.status] * 0.4 +
		statusScores[impact.averageImpactScore.status] * 0.3 +
		statusScores[impact.projectCompletionRate.status] * 0.3;

	const financialScore =
		statusScores[financial.monthsOfOperation.status] * 0.3 +
		statusScores[financial.debtRatio.status] * 0.2 +
		statusScores[financial.revenueGrowth.status] * 0.3 +
		statusScores[financial.liquidity.status] * 0.2;

	const overallScore =
		efficiencyScore * weights.efficiency +
		impactScore * weights.impact +
		financialScore * weights.financial;

	return {
		score: Math.round(overallScore),
		grade:
			overallScore >= 90
				? 'A'
				: overallScore >= 80
				? 'B'
				: overallScore >= 70
				? 'C'
				: overallScore >= 60
				? 'D'
				: 'F',
		breakdown: {
			efficiency: Math.round(efficiencyScore),
			impact: Math.round(impactScore),
			financial: Math.round(financialScore),
		},
	};
}

export default router;
