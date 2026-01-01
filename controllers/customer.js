import Customer from '../models/Customer.js';

export const getCustomers = async (req, res) => {
	try {
		const { outletId, search, type } = req.query;
		const filter = {};

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
			createdBy: req.user.id,
			outletId: req.body.outletId || req.user.outletId,
		};

		// Generate customer ID
		const timestamp = Date.now();
		const random = Math.floor(Math.random() * 1000);
		customerData.customerId = `CUST-${timestamp}-${random}`;

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
		res.json({
			success: true,
			customer,
		});
	} catch (error) {
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
		const { amount, type } = req.body; // type: 'add' or 'subtract'

		const customer = await Customer.findById(req.params.id);
		if (!customer) {
			return res.status(404).json({
				success: false,
				message: 'Customer not found',
			});
		}

		if (type === 'add') {
			customer.creditInfo.currentDebt += amount;
		} else if (type === 'subtract') {
			customer.creditInfo.currentDebt = Math.max(
				0,
				customer.creditInfo.currentDebt - amount
			);
		}

		await customer.save();

		res.json({
			success: true,
			message: 'Customer debt updated',
			currentDebt: customer.creditInfo.currentDebt,
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
		const customer = await Customer.findByIdAndDelete(id);
		if (!customer) {
			return res.status(404).json({
				success: false,
				message: 'Customer not found',
			});
		}
		res.json({
			success: true,
			message: 'Customer deleted successfully',
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
