import Transaction from '../models/Transaction.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Outlet from '../models/Outlet.js';
import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import Order from '../models/Order.js';
import Debt from '../models/Debt.js';

export const getMikiyaPlasticDashboard = async (req, res) => {
	try {
		console.log('Fetching Mikiya Plastic dashboard data...');

		// Fetch data in parallel for performance
		const [
			transactions,
			totalCustomers,
			totalProducts,
			totalOutlets,
			totalSales,
			outStandingDebt,
		] = await Promise.all([
			Transaction.find().limit(10).sort({ createdAt: -1 }), // latest 10
			Customer.countDocuments(),
			Product.countDocuments(),
			Outlet.countDocuments(),
			Payment.aggregate([
				{ $group: { _id: null, total: { $sum: '$amount' } } },
			]),
			Invoice.aggregate([
				{ $group: { _id: null, total: { $sum: '$amount' } } },
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

		const dashboardData = {
			totalSales: totalSales[0]?.total || 20000,
			totalCustomers,
			totalProducts,
			totalOutlets,
			transactions,
			totalOutStandingDebt: outStandingDebt[0]?.total || 5000,
			outletPerformance,
			salesTrends,
		};

		res.status(200).json(dashboardData);
	} catch (error) {
		console.error(error);
		res.status(400).json({ error: error.message });
	}
};
