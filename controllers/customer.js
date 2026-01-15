import Customer from '../models/Customer.js';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import Business from '../models/Business.js';
import Outlet from '../models/Outlet.js';

export const getCustomers = async (req, res) => {
	try {
		const { outletId, businessId, search, type } = req.query;
		const filter = {};

		if (businessId) {
			filter.businessId = businessId;
		}
		if (outletId) {
			filter.outletId = outletId;
		} else if (req.user.role !== 'admin') {
			// Staff can only see customers from their outlet
			filter.outletId = req.user.outletId;
		}

		if (search) {
			filter.$or = [
				{ name: { $regex: search, $options: 'i' } },
				{ phone: { $regex: search, $options: 'i' } },
				{ email: { $regex: search, $options: 'i' } },
				{ customerId: { $regex: search, $options: 'i' } },
			];
		}

		if (type) {
			filter.type = type;
		}

		const customers = await Customer.find(filter)
			.populate('outletId', 'name')
			.sort({ createdAt: -1 });

		res.json({
			success: true,
			count: customers.length,
			customers,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: 'Failed to fetch customers',
			error: error.message,
		});
	}
};

export const createCustomer = async (req, res) => {
	try {
		const customerData = {
			...req.body,
			createdBy: req.user._id,
			outletId: req.body.outletId || req.user.outletId,
		};
		// console.log('req.user', req.user);

		const business = await Business.findOne({ _id: req.user.businessId });
		console.log('business', business);
		// Generate customer ID
		const timestamp = Date.now();
		const random = Math.floor(Math.random() * 1000);
		customerData.customerId = `CUST-${timestamp}-${random}`;
		customerData.businessId = business._id;

		const customer = new Customer(customerData);
		await customer.save();

		res.status(201).json({
			success: true,
			message: 'Customer created successfully',
			customer,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: 'Failed to create customer',
			error: error.message,
		});
	}
};

export const getCustomerById = async (req, res) => {
	try {
		const { id } = req.params;
		const customer = await Customer.findById(id)
			.populate('outletId', 'name')
			.populate('createdBy', 'username email');
		if (!customer) {
			return res.status(404).json({
				success: false,
				message: 'Customer not found',
			});
		}
		const totalOrders = await Invoice.countDocuments({ customerId: id });
		const totalPurchases = await Payment.aggregate([
			{ $match: { customerId: id } },
			{ $group: { _id: null, total: { $sum: '$amount' } } },
		]);
		const payments = await Payment.find({ customerId: id })
			.populate('createdBy', 'username email')
			.populate({
				path: 'invoiceId',
				select: 'status customerId outletId',
				populate: {
					path: 'outletId',
					select: 'name',
				},
			});
		const transactions = await Invoice.find({ customerId: id })
			.sort({ createdAt: -1 })
			.populate('outletId', 'name address')
			.populate('items.productId', 'title price');

		const totalDebt = await Invoice.aggregate([
			{ $match: { customerId: id, balance: { $gt: 0 } } }, // only invoices with unpaid debt
			{ $group: { _id: null, total: { $sum: '$balance' } } },
		]);
		const averageOrderValue = totalPurchases / totalOrders;
		const data = {
			...customer._doc,
			totalPurchases: totalPurchases[0]?.total || 0,
			totalOrders,
			averageOrderValue,
			totalDebt: totalDebt[0]?.total || 0,
			transactions,
			payments,
		};
		res.json(data);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: error.message });
	}
};

export const getCustomerDebtors = async (req, res) => {
	try {
		const filter = {
			'creditInfo.currentDebt': { $gt: 0 },
			'creditInfo.creditEnabled': true,
		};

		if (req.user.role !== 'admin' && req.user.outletId) {
			filter.outletId = req.user.outletId;
		}
		// if (req.user.role === 'staff' && req.user.outletId) {
		// 	filter.outletId = req.user.outletId;
		// }

		const debtors = await Customer.find(filter)
			.populate('outletId', 'name')
			.sort({ 'creditInfo.currentDebt': -1 });

		const totalDebt = debtors.reduce(
			(sum, customer) => sum + customer.creditInfo.currentDebt,
			0
		);

		res.json({
			success: true,
			count: debtors.length,
			totalDebt,
			debtors,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: 'Failed to fetch debtors',
			error: error.message,
		});
	}
};
export const updateCustomer = async (req, res) => {
	try {
		const { id } = req.params;
		const customer = await Customer.findByIdAndUpdate(id, req.body, {
			new: true,
		});
		if (!customer) {
			return res.status(404).json({
				success: false,
				message: 'Customer not found',
			});
		}
		res.json({
			success: true,
			message: 'Customer updated successfully',
			customer,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const updateCustomerDebt = async (req, res) => {
	try {
		const { amount, type } = req.body; // type: 'add', 'remove' or 'set'

		const customer = await Customer.findById(req.params.id);
		if (!customer) {
			return res.status(404).json({
				success: false,
				message: 'Customer not found',
			});
		}

		if (type === 'add') {
			customer.currentDebt += amount;
		} else if (type === 'remove') {
			customer.currentDebt = Math.max(0, customer.currentDebt - amount);
		} else if (type === 'set') {
			customer.currentDebt = amount;
		}
		await customer.save();

		res.json({
			success: true,
			message: 'Customer debt updated',
			currentDebt: customer.currentDebt,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: 'Failed to update debt',
			error: error.message,
		});
	}
};
export const updateCustomerCredit = async (req, res) => {
	try {
		const { amount, type } = req.body; // type: 'add', 'remove' or 'set'

		const customer = await Customer.findById(req.params.id);
		if (!customer) {
			return res.status(404).json({
				success: false,
				message: 'Customer not found',
			});
		}

		if (type === 'add') {
			customer.creditBalance += amount;
		} else if (type === 'remove') {
			customer.creditBalance = Math.max(0, customer.creditBalance - amount);
		} else if (type === 'set') {
			customer.creditBalance = amount;
		}
		await customer.save();

		res.json({
			success: true,
			message: 'Customer credit updated',
			creditBalance: customer.creditBalance,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: 'Failed to update debt',
			error: error.message,
		});
	}
};

export const deleteCustomer = async (req, res) => {
	try {
		const { id } = req.params;
		const customer = await Customer.findById(id);
		if (!customer) {
			return res.status(404).json({
				success: false,
				message: 'Customer not found',
			});
		}
		const invoice = await Invoice.find({ customerId: req.params.id });
		if (invoice.length > 0) {
			return res.status(400).json({
				success: false,
				message: 'Cannot delete customer with an invoice',
			});
		}
		await Customer.findByIdAndDelete(id);
		res.json({
			success: true,
			message: 'Customer deleted successfully',
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
