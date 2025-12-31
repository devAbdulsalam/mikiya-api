import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import OutletProduct from '../models/OutletProduct.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Outlet from '../models/Outlet.js';
import Payment from '../models/Payment.js';

export const getAllInvoices = async (req, res) => {
	try {
		// Fetch invoices with all necessary population
		const invoices = await Invoice.find()
			// .select('amounts createdAt dueDate status')
			.sort({ createdAt: -1 })
			.populate('outletId', 'name address')
			.populate('customerId', 'name phone email')
			.populate('items.productId', 'title price');

		// Compute totals dynamically
		const totalInvoices = invoices.length;
		const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0);
		const totalOrders = invoices.reduce(
			(sum, inv) => sum + inv.items.length,
			0
		);
		const completedOrders = invoices.filter(
			(inv) => inv.status === 'paid'
		).length;
		const pendingOrders = invoices.filter(
			(inv) => inv.status !== 'paid'
		).length;

		res.json({
			success: true,
			message: 'Invoices fetched successfully',
			count: totalInvoices,
			totalInvoices,
			totalSales,
			totalOrders,
			completedOrders,
			pendingOrders,
			invoices,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
};

export const getOrderStats = async (req, res) => {
	try {
		const invoices = await Invoice.find()
			.populate('outletId', 'name')
			.populate('customerId', 'name');

		const stats = await Invoice.aggregate([
			{
				$group: {
					_id: null,
					totalSales: { $sum: '$total' },
					totalInvoices: { $sum: 1 },
				},
			},
		]);

		const { totalSales, totalInvoices } = stats[0] || {
			totalSales: 0,
			totalInvoices: 0,
		};
		const completedOrders = invoices.filter((i) => i.status === 'paid').length;
		const pendingOrders = invoices.filter((i) => i.status !== 'paid').length;
		const totalOrders = invoices.reduce(
			(sum, inv) => sum + inv.items.length,
			0
		);

		res.json({
			success: true,
			message: 'Invoices fetched successfully',
			count: totalInvoices,
			totalInvoices,
			totalSales,
			totalOrders,
			completedOrders,
			pendingOrders,
			invoices,
		});
	} catch (error) {
		res.status(500).json({ success: false, error: error.message });
	}
};

export const newInvoice = async (req, res) => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const {
			outletId,
			customerId,
			items,
			subtotal,
			tax,
			total,
			paymentMethod,
			paymentTerms,
			note,
			amountPaid,
			paymentInfo,
		} = req.body;

		console.log('Create Invoice Req User:', req.user);

		// ===== Validate Customer & Outlet =====
		const [outlet, customer] = await Promise.all([
			Outlet.findById(outletId).session(session),
			Customer.findById(customerId).session(session),
		]);

		if (!outlet) throw new Error('Outlet not found');
		if (!customer) throw new Error('Customer not found');

		// ===== Stock Validation + Deduct =====
		const productIds = items.map((i) => i.productId);
		const products = await Product.find({ _id: { $in: productIds } }).session(
			session
		);

		for (const item of items) {
			const product = products.find((p) => p._id.toString() === item.productId);
			if (!product) throw new Error(`Product ${item.productId} not found`);
			if (product.stock < item.quantity)
				throw new Error(`Insufficient stock for product ${item.productId}`);

			product.stock -= item.quantity;
			await product.save({ session });
		}

		// ===== Invoice Status Logic =====
		const balance = total - amountPaid;
		const status =
			balance <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';

		const invoiceNumber = `INV-${Date.now()}`;

		// ===== Create Invoice & Payment =====
		const invoice = await Invoice.create(
			[
				{
					invoiceNumber,
					outletId,
					businessId: outlet.businessId,
					customerId,
					items,
					subtotal,
					tax,
					total,
					paymentTerms,
					note,
					amountPaid,
					balance,
					status,
					createdBy: req.user._id,
				},
			],
			{ session }
		);

		await Payment.create(
			[
				{
					invoiceId: invoice[0]._id,
					customerId,
					amount: amountPaid,
					method: paymentInfo.paymentMethod,
					reference: paymentInfo.reference,
					createdBy: req.user._id,
					date: paymentInfo.date,
				},
			],
			{ session }
		);

		// ===== Customer & Outlet Updates =====
		await Customer.updateOne(
			{ _id: customerId },
			{
				$inc: {
					totalSales: total,
					...(paymentMethod === 'credit' ? { currentDebt: balance } : {}),
				},
			},
			{ session }
		);

		await Outlet.updateOne(
			{ _id: outletId },
			{ $inc: { totalSales: total } },
			{ session }
		);

		// ===== Commit Transaction =====
		await session.commitTransaction();
		session.endSession();

		return res.status(201).json({ success: true, invoice: invoice[0] });
	} catch (error) {
		await session.abortTransaction();
		session.endSession();
		return res.status(400).json({ success: false, error: error.message });
	}
};

export const getInvoiceById = async (req, res) => {
	try {
		const invoice = await Invoice.findById(req.params.id);
		if (!invoice) {
			return res.status(404).json({ error: 'Invoice not found' });
		}
		res.json(invoice);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
export const updateInvoice = async (req, res) => {
	try {
		const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
		});
		if (!invoice) {
			return res.status(404).json({ error: 'Invoice not found' });
		}
		res.json(invoice);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
export const deleteInvoice = async (req, res) => {
	try {
		const invoice = await Invoice.findByIdAndDelete(req.params.id);
		if (!invoice) {
			return res.status(404).json({ error: 'Invoice not found' });
		}
		res.json({ message: 'Invoice deleted successfully' });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
