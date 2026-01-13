import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Outlet from '../models/Outlet.js';
import Payment from '../models/Payment.js';
import { uploadBufferToCloudinary } from '../utils/uploadAndExtractImageUrls.js';
const vat = 0;
export const getAllInvoices = async (req, res) => {
	try {
		// Fetch invoices with all necessary population
		const invoices = await Invoice.find()
			.sort({ createdAt: -1 })
			.populate('outletId', 'name address')
			.populate('items.productId', 'title price')
			.populate('customerId', 'name phone email address');

		// Compute totals dynamically
		const totalInvoices = invoices.length;
		const totalSales = invoices?.reduce((sum, inv) => sum + inv.total, 0);
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

		const totalPendingOrders = invoices
			.filter((inv) => inv.status !== 'paid')
			.reduce((sum, inv) => sum + inv.balance, 0);

		const totalCompletedOrders = invoices
			.filter((inv) => inv.status === 'paid')
			.reduce((sum, inv) => sum + inv.amountPaid, 0);
		res.json({
			success: true,
			message: 'Invoices fetched successfully',
			count: totalInvoices,
			totalInvoices,
			totalSales,
			totalOrders,
			completedOrders,
			totalCompletedOrders,
			pendingOrders,
			invoices,
			totalPendingOrders,
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
			.populate('customerId', 'name phone email address');

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

	try {
		session.startTransaction();
		const {
			outletId,
			customerId,
			subtotal,
			tax,
			total,
			paymentMethod,
			paymentTerms,
			notes,
			amountPaid,
		} = req.body;

		// console.log('items', req.body.items);
		let items = req.body.items;

		if (!items) {
			throw new Error('Invoice items are missing');
		}

		items = Array.isArray(items) ? items : JSON.parse(items);

		// console.log('Final invoice items:', items);
		const paymentInfo = req.body.paymentInfo
			? JSON.parse(req.body.paymentInfo)
			: null;

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
		// console.log('productIds', productIds);
		for (const item of items) {
			const product = products.find((p) => p._id.toString() === item.productId);
			if (!product) throw new Error(`Product ${item.productId} not found`);
			if (product.stock < item.quantity)
				throw new Error(`Insufficient stock for product ${item.productId}`);

			product.stock -= item.quantity;
			await product.save({ session });
		}

		// ===== Invoice Logic =====
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
					items: items.map(({ _id, ...rest }) => rest),
					subtotal,
					tax,
					total,
					paymentTerms,
					notes,
					amountPaid,
					balance,
					status,
					createdBy: req.user._id,
				},
			],
			{ session }
		);
		let receipt = null;

		// ===== Payment Record =====
		if (amountPaid > 0) {
			await Payment.create(
				[
					{
						invoiceId: invoice[0]._id,
						customerId: customer._id,
						amount: amountPaid,
						method: paymentInfo?.method || paymentMethod,
						reference: paymentInfo?.reference || null,
						date: paymentInfo?.date || new Date(),
						createdBy: req.user._id,
					},
				],
				{ session }
			);
		}
		let creditBalanceChange = 0;
		let debtChange = 0;

		if (amountPaid > total) {
			// Overpayment → store as credit
			creditBalanceChange = amountPaid - total;
			debtChange = 0;
		} else if (amountPaid < total) {
			// Underpayment → customer owes balance
			creditBalanceChange = 0;
			debtChange = total - amountPaid;
		} else {
			// Exact payment
			creditBalanceChange = 0;
			debtChange = 0;
		}

		// ===== Update Customer =====
		await Customer.updateOne(
			{ _id: customer._id },
			{
				$inc: {
					creditBalance: creditBalanceChange,
					currentDebt: debtChange,
					totalSales: total,
				},
			},
			{ session }
		);
		// ===== Commit Transaction =====
		await session.commitTransaction();
		if (req.file) {
			receipt = await uploadBufferToCloudinary(
				req.file.buffer,
				`receipt_${invoice[0]._id}`
			);

			await Payment.updateOne({ invoiceId: invoice[0]._id }, { receipt });
		}

		return res.status(201).json({ success: true, invoice: invoice[0] });
	} catch (error) {
		console.error(error);
		if (session.inTransaction()) {
			await session.abortTransaction();
		}
		return res.status(400).json({ success: false, error: error.message });
	} finally {
		session.endSession();
	}
};

export const getInvoiceById = async (req, res) => {
	try {
		const invoice = await Invoice.findById(req.params.id)
			.populate('customerId', 'name phone email address')
			.populate('items.productId', 'title price');
		if (!invoice) {
			return res.status(404).json({ error: 'Invoice not found' });
		}
		const payments = await Payment.find({ invoiceId: invoice._id });
		const data = { ...invoice._doc, payments };
		res.json(data);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
export const updateInvoice = async (req, res) => {
	const session = await mongoose.startSession();

	try {
		session.startTransaction();

		const { id } = req.params;
		const {
			items: rawItems,
			amountPaid = 0,
			paymentMethod,
			paymentInfo,
			customerId,
			notes,
			paymentTerms,
		} = req.body;

		if (!rawItems) throw new Error('Invoice items are required');

		const items = Array.isArray(rawItems) ? rawItems : JSON.parse(rawItems);

		// ===== Fetch Existing Invoice =====
		const existingInvoice = await Invoice.findById(id).session(session);
		if (!existingInvoice) {
			await session.abortTransaction();
			return res
				.status(404)
				.json({ success: false, error: 'Invoice not found' });
		}

		// ===== Restore Old Stock =====
		for (const oldItem of existingInvoice.items) {
			await Product.findByIdAndUpdate(
				oldItem.productId,
				{ $inc: { stock: oldItem.quantity } },
				{ session }
			);
		}

		// ===== Validate & Deduct New Stock =====
		for (const item of items) {
			const product = await Product.findById(item.productId).session(session);
			if (!product) throw new Error('Product not found');

			if (product.stock < item.quantity)
				throw new Error(`Insufficient stock for ${product.title}`);

			product.stock -= item.quantity;
			await product.save({ session });
		}

		// ===== Recalculate Invoice Totals (SERVER SIDE) =====
		const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
		const tax = subtotal * vat; // 7.5% VAT
		const total = subtotal + tax;

		const balance = total - amountPaid;
		const status =
			balance <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';

		// ===== Update Invoice =====
		const invoice = await Invoice.findByIdAndUpdate(
			id,
			{
				items,
				subtotal,
				tax,
				total,
				amountPaid,
				balance,
				status,
				notes,
				paymentTerms,
			},
			{ new: true, session }
		);

		// ===== Payment Delta (Prevent Duplicate Payments) =====
		const paymentDelta = amountPaid - existingInvoice.amountPaid;

		let payment = null;
		if (paymentDelta > 0) {
			[payment] = await Payment.create(
				[
					{
						invoiceId: invoice._id,
						customerId: customerId || invoice.customerId,
						amount: paymentDelta,
						method: paymentInfo?.method || paymentMethod,
						reference: paymentInfo?.reference || null,
						date: paymentInfo?.date || new Date(),
						createdBy: req.user._id,
					},
				],
				{ session }
			);
		}

		// ===== Adjust Customer Debt (Delta-Based) =====
		const oldBalance = existingInvoice.balance;
		const newBalance = balance;
		const debtChange = newBalance - oldBalance;

		await Customer.updateOne(
			{ _id: invoice.customerId },
			{
				$inc: {
					currentDebt: debtChange,
				},
			},
			{ session }
		);

		// ===== Commit Transaction =====
		await session.commitTransaction();

		// ===== Upload Receipt (Post-Commit) =====
		if (req.file && payment) {
			const receipt = await uploadBufferToCloudinary(
				req.file.buffer,
				`receipt_${payment._id}`
			);

			await Payment.findByIdAndUpdate(payment._id, { receipt });
		}

		return res.status(200).json({
			success: true,
			invoice,
			payment,
		});
	} catch (error) {
		console.error(error);

		if (session.inTransaction()) {
			await session.abortTransaction();
		}

		return res.status(400).json({
			success: false,
			error: error.message,
		});
	} finally {
		session.endSession();
	}
};

export const deleteInvoice = async (req, res) => {
	try {
		const invoice = await Invoice.findById(req.params.id);
		if (!invoice) {
			return res.status(404).json({ error: 'Invoice not found' });
		}
		const payment = await Payment.findOne({ invoiceId: req.params.id });
		if (payment) {
			return res.status(404).json({ error: 'Invoice already have payment' });
		}
		const customer = await Customer.findOne({ _id: invoice.customerId });

		customer.currentDebt -= invoice.amountPaid;
		customer.creditBalance += invoice.amountPaid;
		customer.totalSales -= invoice.total;
		await customer.save();
		await Invoice.findByIdAndDelete(req.params.id);
		res.json({ message: 'Invoice deleted successfully' });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
