import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Outlet from '../models/Outlet.js';
import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import Business from '../models/Business.js';
import Order from '../models/Order.js';
import Debt from '../models/Debt.js';
import Donation from '../models/Donation.js';
import Project from '../models/Project.js';
import Fund from '../models/Fund.js';
import FoundationExpense from '../models/FoundationExpense.js';

export const cashFlow = async (req, res) => {
	const { foundationId } = req.query;

	const income = await Fund.aggregate([
		{ $match: { foundationId, isDeleted: false } },
		{ $group: { _id: null, totalIncome: { $sum: '$amount' } } },
	]);

	const expenses = await FoundationExpense.aggregate([
		{ $match: { foundationId, isDeleted: false, status: 'paid' } },
		{ $group: { _id: null, totalExpense: { $sum: '$amount' } } },
	]);

	res.json({
		income: income[0]?.totalIncome || 0,
		expenses: expenses[0]?.totalExpense || 0,
		balance: (income[0]?.totalIncome || 0) - (expenses[0]?.totalExpense || 0),
	});
};

export const fundSummary = async (req, res) => {
	const { foundationId } = req.query;

	const summary = await Fund.aggregate([
		{ $match: { foundationId, isDeleted: false } },
		{
			$group: {
				_id: '$sourceType',
				total: { $sum: '$amount' },
			},
		},
	]);

	res.json(summary);
};

export const monthlyFinance = async (req, res) => {
	const { foundationId, year } = req.query;

	const income = await Fund.aggregate([
		{ $match: { foundationId, isDeleted: false } },
		{
			$project: {
				amount: 1,
				month: { $month: '$receivedDate' },
				year: { $year: '$receivedDate' },
			},
		},
		{ $match: { year: Number(year) } },
		{
			$group: {
				_id: '$month',
				income: { $sum: '$amount' },
			},
		},
	]);

	const expenses = await FoundationExpense.aggregate([
		{ $match: { foundationId, isDeleted: false, status: 'paid' } },
		{
			$project: {
				amount: 1,
				month: { $month: '$date' },
				year: { $year: '$date' },
			},
		},
		{ $match: { year: Number(year) } },
		{
			$group: {
				_id: '$month',
				expenses: { $sum: '$amount' },
			},
		},
	]);

	res.json({ income, expenses });
};

export const projectBudgetHealth = async (req, res) => {
	const projects = await Project.aggregate([
		{ $match: { foundationId: req.query.foundationId, isDeleted: false } },
		{
			$project: {
				name: 1,
				budget: 1,
				spent: 1,
				remaining: { $subtract: ['$budget', '$spent'] },
				usagePercent: {
					$cond: [
						{ $gt: ['$budget', 0] },
						{ $multiply: [{ $divide: ['$spent', '$budget'] }, 100] },
						0,
					],
				},
			},
		},
	]);

	res.json(projects);
};

export const expenseByCategory = async (req, res) => {
	const data = await Expense.aggregate([
		{
			$match: {
				foundationId: req.query.foundationId,
				isDeleted: false,
				status: 'paid',
			},
		},
		{
			$group: {
				_id: '$category',
				total: { $sum: '$amount' },
			},
		},
	]);

	res.json(data);
};

export const topDonors = async (req, res) => {
	const donors = await Donation.aggregate([
		{ $match: { foundationId: req.query.foundationId, isDeleted: false } },
		{
			$group: {
				_id: '$donorId',
				totalDonated: { $sum: '$amount' },
			},
		},
		{ $sort: { totalDonated: -1 } },
		{ $limit: 10 },
	]);

	res.json(donors);
};

export const getBusinessDashboard = async (req, res) => {
	try {
		console.log('Fetching Mikiya Plastic dashboard data...');
		const businessId = req.params.id;

		// Fetch invoices with all necessary population

		console.log('businessId:', businessId);
		// Fetch data in parallel for performance
		const [
			business,
			transactions,
			totalCustomers,
			totalProducts,
			totalProductWorth,
			totalOutlets,
			invoiceSummary,
		] = await Promise.all([
			Business.findById(businessId),
			Invoice.find({ businessId })
				.limit(10)
				.sort({ createdAt: -1 }) // latest 10
				.populate('outletId', 'name address')
				.populate('customerId', 'name phone email')
				.populate('items.productId', 'title price'),
			Customer.countDocuments({ businessId }),
			Product.countDocuments({ businessId }),
			Product.aggregate([
				{
					$match: {
						businessId,
					},
				},
				{
					$group: {
						_id: null,
						totalWorth: {
							$sum: { $multiply: ['$price', '$stock'] },
						},
					},
				},
			]),
			Outlet.countDocuments({ businessId }),
			Invoice.aggregate([
				{ $match: { businessId: new mongoose.Types.ObjectId(businessId) } },
				{
					$group: {
						_id: null,
						totalSales: { $sum: '$total' },
						totalDebt: {
							$sum: {
								$cond: [{ $gt: ['$balance', 0] }, '$balance', 0],
							},
						},
					},
				},
			]),
		]);

		const totalSales = invoiceSummary[0]?.totalSales || 0;
		const totalOutStandingDebt = invoiceSummary[0]?.totalDebt || 0;

		const [summary] = await Payment.aggregate([
			{
				$match: {
					businessId: new mongoose.Types.ObjectId(businessId),
				},
			},
			{
				$group: {
					_id: null,
					totalPayment: { $sum: '$amount' },
					totalTransactions: { $sum: 1 },
					avgPayment: { $avg: '$amount' },
					cashTotal: {
						$sum: { $cond: [{ $eq: ['$method', 'cash'] }, '$amount', 0] },
					},
					cardTotal: {
						$sum: { $cond: [{ $eq: ['$method', 'card'] }, '$amount', 0] },
					},
				},
			},
		]);

		const result = {
			totalPayment: summary?.totalPayment || 0,
			totalTransactions: summary?.totalTransactions || 0,
			avgPayment: summary?.avgPayment || 0,
			cashTotal: summary?.cashTotal || 0,
			cardTotal: summary?.cardTotal || 0,
		};

		// Example static charts/data
		const salesTrends = [
			{ date: 'Jan', sales: 34000 },
			{ date: 'Feb', sales: 42000 },
			{ date: 'Mar', sales: 39000 },
			{ date: 'Apr', sales: 45000 },
			{ date: 'May', sales: 52000 },
			{ date: 'Jun', sales: 48000 },
		];

		const outletPerformance = [
			{ name: 'Main Store', sales: 45000 },
			{ name: 'Business District Branch', sales: 38000 },
			{ name: 'Wholesale Center', sales: 78000 },
			{ name: 'Main Store2', sales: 45000 },
			{ name: 'Business District Branch2', sales: 38000 },
			{ name: 'Wholesale Center2', sales: 78000 },
		];

		// console.log('Dashboard data fetched successfully.');
		// console.log('businessId:', businessId);
		console.log('Outstanding debt:', totalOutStandingDebt);
		console.log('Total sales:', totalSales);

		const dashboardData = {
			totalSales,
			totalOutStandingDebt,
			totalCustomers,
			totalProducts,
			totalOutlets,
			transactions,
			outletPerformance,
			salesTrends,
			business,
			currentProducts: totalProductWorth[0]?.totalWorth || 0,
			result,
		};

		res.status(200).json(dashboardData);
	} catch (error) {
		console.error(error);
		res.status(400).json({ error: error.message });
	}
};

export const getDebtStats = async (req, res) => {
	try {
		const businessId = req.params.id;
		const outstanding = await Invoice.aggregate([
			{ $match: { businessId, balance: { $gt: 0 } } },
			{ $group: { _id: null, total: { $sum: '$balance' } } },
		]);

		const totalOutstandingDebt = outstanding[0]?.total || 0;

		const totalCustomersWithDebt = await Customer.countDocuments({
			currentDebt: { $gt: 0 },
		});

		const [pendingInvoices, debtAgg] = await Promise.all([
			Invoice.find({ businessId, status: { $ne: 'paid' } })
				.populate('outletId', 'name address')
				.populate('customerId', 'name phone email')
				.populate('items.productId', 'title price'),
			Invoice.aggregate([
				{
					$match: {
						businessId: new mongoose.Types.ObjectId(businessId),
						status: { $ne: 'paid' },
					},
				},
				{ $group: { _id: null, total: { $sum: '$balance' } } },
			]),
		]);

		const totalDebt = debtAgg[0]?.total || 0;

		return res.json({
			success: true,
			totalPendingInvoices: pendingInvoices.length,
			totalDebt,
			debts: pendingInvoices,
			totalOutstandingDebt,
			totalCustomersWithDebt,
			message: 'Debt stats fetched successfully',
		});
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: error.message });
	}
};
