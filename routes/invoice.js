import express from 'express';
import Invoice from '../models/Invoice.js';
import OutletProduct from '../models/OutletProduct.js';
import Customer from '../models/Customer.js';
import Outlet from '../models/Outlet.js';
import { auth } from '../middlewares/auth.js';
const router = express.Router();

router.get('/', auth, async (req, res) => {
	try {
		const invoices = await Invoice.find()
			.populate('outletId')
			.populate('customerId')
			.populate('items.productId');
		res.json(invoices);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.post('/', auth, async (req, res) => {
	try {
		const {
			outletId,
			customerId,
			items,
			subtotal,
			tax,
			total,
			paymentMethod,
			amountPaid,
		} = req.body;

		// Check if the outlet exists
		const outlet = await Outlet.findById(outletId);
		if (!outlet) {
			return res.status(404).json({ error: 'Outlet not found' });
		}

		// Check if the customer exists
		const customer = await Customer.findById(customerId);
		if (!customer) {
			return res.status(404).json({ error: 'Customer not found' });
		}

		// Check stock for each item and update
		for (let item of items) {
			const outletProduct = await OutletProduct.findOne({
				outletId,
				productId: item.productId,
			});
			if (!outletProduct) {
				return res
					.status(400)
					.json({ error: `Product ${item.productId} not found in outlet` });
			}
			if (outletProduct.stock < item.quantity) {
				return res
					.status(400)
					.json({ error: `Insufficient stock for product ${item.productId}` });
			}
			// Reduce stock
			outletProduct.stock -= item.quantity;
			await outletProduct.save();
		}

		// Calculate balance and status
		const balance = total - amountPaid;
		let status = 'unpaid';
		if (balance <= 0) {
			status = 'paid';
		} else if (amountPaid > 0) {
			status = 'partial';
		}

		// Generate invoice number (you can use a more sophisticated method)
		const invoiceNumber = `INV-${Date.now()}`;

		const invoice = new Invoice({
			invoiceNumber,
			outletId,
			customerId,
			items,
			subtotal,
			tax,
			total,
			paymentMethod,
			amountPaid,
			balance,
			status,
			createdBy: req.user.userId,
		});

		await invoice.save();

		// Update customer's totalSales and currentDebt
		customer.totalSales += total;
		if (paymentMethod === 'credit') {
			customer.currentDebt += balance;
		}
		await customer.save();

		// Update outlet's totalSales
		outlet.totalSales += total;
		await outlet.save();

		res.status(201).json(invoice);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
});

// ... other routes for getting, updating, deleting invoices

export default router;
