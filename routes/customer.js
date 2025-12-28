import express from 'express'
import Customer from '../models/Customer.js'
import Transaction from '../models/Transaction.js'
import { auth } from '../middlewares/auth.js'

const router = express.Router();

// Get all customers for an outlet
router.get('/', auth, async (req, res) => {
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
				{ 'contact.phone': { $regex: search, $options: 'i' } },
				{ 'contact.email': { $regex: search, $options: 'i' } },
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
});

// Get customer with debt details
router.get('/debtors', auth, async (req, res) => {
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
});

// Create customer
router.post('/', auth, async (req, res) => {
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
});

// Update customer debt (when transaction is made)
router.put('/:id/debt', auth, async (req, res) => {
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
});

export default router;
