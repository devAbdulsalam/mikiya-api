import Transaction from '../models/Transaction.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Outlet from '../models/Outlet.js';
import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import Business from '../models/Business.js';
import Order from '../models/Order.js';
import Debt from '../models/Debt.js';

export const getBusinessDashboard = async (req, res) => {
	try {
		console.log('Fetching Mikiya Plastic dashboard data...');
		const businessId = req.params.id;

		// Fetch invoices with all necessary population

		// Fetch data in parallel for performance
		const [
			business,
			transactions,
			totalCustomers,
			totalProducts,
			totalOutlets,
			totalSales,
			outStandingDebt,
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
			Outlet.countDocuments({ businessId }),
			Payment.aggregate([
				{ $match: { businessId } },
				{ $group: { _id: null, total: { $sum: '$amount' } } },
			]),
			Invoice.aggregate([
				{ $match: { businessId, balance: { $gt: 0 } } }, // only invoices with unpaid debt
				{ $group: { _id: null, total: { $sum: '$balance' } } },
			]),
		]);

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
		];

		console.log('Dashboard data fetched successfully.');
		console.log('Outstanding debt:', outStandingDebt[0]?.total);
		console.log('Total sales:', totalSales[0]?.total);
		console.log('businessId:', businessId);

		const dashboardData = {
			totalSales: totalSales[0]?.total || 20000,
			totalCustomers,
			totalProducts,
			totalOutlets,
			transactions,
			totalOutStandingDebt: outStandingDebt[0]?.total || 5000,
			outletPerformance,
			salesTrends,
			business
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
			{ $match: {businessId, balance: { $gt: 0 } } },
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
				{ $match: { businessId, status: { $ne: 'paid' } } },
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
