import Payment from '../models/Payment.js';
import Customer from '../models/Customer.js';
import Invoice from '../models/Invoice.js';
import { uploadBufferToCloudinary } from '../utils/uploadAndExtractImageUrls.js';

export const getPayments = async (req, res) => {
	try {
		const payments = await Payment.find()
			.populate('invoiceId')
			.populate('customerId')
			.populate('createdBy', 'username email');

		res.json({ success: true, payments });
	} catch (error) {
		console.error('Get Payments Error:', error);
		res.status(500).json({ error: error.message });
	}
};
export const getPaymentById = async (req, res) => {
	try {
		const payment = await Payment.findById(req.params.id)
			.populate('invoiceId')
			.populate('customerId')
			.populate('createdBy', 'username email');
		res.json(payment);
	} catch (error) {
		console.error('Get Payment By ID Error:', error);
		res.status(500).json({ error: error.message });
	}
};
export const newPayment = async (req, res) => {
	try {
		const { invoiceId, customerId, amount, method, reference } = req.body;

		const customer = await Customer.findById(customerId);
		if (!customer) {
			return res.status(404).json({ error: 'Customer not found' });
		}
		if (invoiceId) {
			const invoice = await Invoice.findById(invoiceId);
			if (!invoice) {
				return res.status(404).json({ error: 'Invoice not found' });
			}
		}

		// console.log('Create Invoice Req file:', req.file);
		let receipt;
		if (req.file) {
			receipt = await uploadBufferToCloudinary(
				req.file.buffer,
				`receipt_${invoiceId}`
			);
			// console.log('receipt', receipt)
		} else {
			receipt = null;
		}

		const payment = new Payment({
			receipt,
			invoiceId,
			customerId,
			amount,
			method,
			receipt,
			reference,
			createdBy: req.user._id,
		});

		await payment.save();

		// --- Update customer debt ---
		const paymentAmount = Number(amount);
		let currentDebt = Number(customer.creditInfo.currentDebt || 0);
		let creditBalance = Number(customer.creditInfo.creditBalance || 0);

		currentDebt -= paymentAmount;

		if (currentDebt < 0) {
			creditBalance += Math.abs(currentDebt); // excess payment becomes credit
			currentDebt = 0;
		}

		customer.creditInfo.currentDebt = currentDebt;
		customer.creditInfo.creditBalance = creditBalance;

		await customer.save();

		// --- Update invoice if linked ---
		if (invoiceId) {
			const invoice = await Invoice.findById(invoiceId);

			if (invoice) {
				invoice.amountPaid = Number(invoice.amountPaid || 0) + paymentAmount;
				invoice.balance = Number(invoice.total) - invoice.amountPaid;

				if (invoice.balance <= 0) {
					invoice.status = 'paid';
					invoice.balance = 0;
				} else {
					invoice.status = 'partial';
				}

				await invoice.save();
			}
		}

		res.status(201).json(payment);
	} catch (error) {
		console.error(error);
		res.status(400).json({ error: error.message });
	}
};

export const updatePayment = async (req, res) => {
	try {
		const { invoiceId, customerId, amount, method, reference } = req.body;
		const paymentAmount = Number(amount);

		if (isNaN(paymentAmount) || paymentAmount <= 0) {
			return res.status(400).json({ error: 'Invalid payment amount' });
		}

		// Fetch existing payment
		const existingPayment = await Payment.findById(req.params.id);
		if (!existingPayment) {
			return res.status(404).json({ error: 'Payment not found' });
		}

		// Fetch customer
		const customer = await Customer.findById(customerId);
		if (!customer) {
			return res.status(404).json({ error: 'Customer not found' });
		}

		// Fetch invoice (if linked)
		let invoice = null;
		if (invoiceId) {
			invoice = await Invoice.findById(invoiceId);
			if (!invoice) {
				return res.status(404).json({ error: 'Invoice not found' });
			}
		}

		let receipt = existingPayment.receipt;
		if (req.file) {
			receipt = await uploadBufferToCloudinary(
				req.file.buffer,
				`receipt_${invoiceId}`
			);
			// console.log('receipt', receipt)
		}

		/* ================================
		   1. ROLLBACK OLD PAYMENT EFFECT
		================================ */

		const oldAmount = Number(existingPayment.amount);

		// rollback customer
		customer.creditInfo.currentDebt += oldAmount;

		if (customer.creditInfo.creditBalance > 0) {
			const usedCredit = Math.min(customer.creditInfo.creditBalance, oldAmount);
			customer.creditInfo.creditBalance -= usedCredit;
			customer.creditInfo.currentDebt -= usedCredit;
		}

		// rollback invoice
		if (invoice) {
			invoice.amountPaid -= oldAmount;
			if (invoice.amountPaid < 0) invoice.amountPaid = 0;

			invoice.balance = Number(invoice.total) - invoice.amountPaid;
			invoice.status = invoice.amountPaid === 0 ? 'unpaid' : 'partial';
		}

		/* ================================
		   2. APPLY NEW PAYMENT EFFECT
		================================ */

		let currentDebt = Number(customer.creditInfo.currentDebt || 0);
		let creditBalance = Number(customer.creditInfo.creditBalance || 0);

		currentDebt -= paymentAmount;

		if (currentDebt < 0) {
			creditBalance += Math.abs(currentDebt);
			currentDebt = 0;
		}

		customer.creditInfo.currentDebt = currentDebt;
		customer.creditInfo.creditBalance = creditBalance;

		if (invoice) {
			invoice.amountPaid = Number(invoice.amountPaid || 0) + paymentAmount;
			invoice.balance = Number(invoice.total) - invoice.amountPaid;

			if (invoice.balance <= 0) {
				invoice.balance = 0;
				invoice.status = 'paid';
			} else {
				invoice.status = 'partial';
			}
		}

		/* ================================
		   3. UPDATE PAYMENT RECORD
		================================ */

		existingPayment.amount = paymentAmount;
		existingPayment.method = method;
		existingPayment.reference = reference;
		existingPayment.invoiceId = invoiceId;
		existingPayment.receipt = receipt;

		await customer.save();
		if (invoice) await invoice.save();
		await existingPayment.save();

		res.json(existingPayment);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// Check delete window (7 days)
const canDeleteDays = 7;

export const deletePayment = async (req, res) => {
	try {
		const payment = await Payment.findById(req.params.id);
		if (!payment) {
			return res.status(404).json({ error: 'Payment not found' });
		}

		// 1. Check delete window
		const now = new Date();
		const createdAt = new Date(payment.createdAt);
		const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);

		if (diffDays > canDeleteDays) {
			return res
				.status(403)
				.json({ error: 'Payment can only be deleted within 7 days' });
		}

		// 2. Fetch customer
		const customer = await Customer.findById(payment.customerId);
		if (!customer) {
			return res.status(404).json({ error: 'Customer not found' });
		}

		// 3. Fetch invoice if linked
		let invoice = null;
		if (payment.invoiceId) {
			invoice = await Invoice.findById(payment.invoiceId);
			if (!invoice) {
				return res.status(404).json({ error: 'Invoice not found' });
			}
		}

		const paymentAmount = Number(payment.amount);

		/* ================================
		   4. ROLLBACK PAYMENT EFFECT
		================================ */

		// rollback customer
		customer.creditInfo.currentDebt += paymentAmount;

		if (customer.creditInfo.creditBalance > 0) {
			const usedCredit = Math.min(
				customer.creditInfo.creditBalance,
				paymentAmount
			);
			customer.creditInfo.creditBalance -= usedCredit;
			customer.creditInfo.currentDebt -= usedCredit;
		}

		// rollback invoice
		if (invoice) {
			invoice.amountPaid -= paymentAmount;
			if (invoice.amountPaid < 0) invoice.amountPaid = 0;

			invoice.balance = Number(invoice.total) - invoice.amountPaid;

			if (invoice.amountPaid === 0) {
				invoice.status = 'unpaid';
			} else if (invoice.balance <= 0) {
				invoice.status = 'paid';
				invoice.balance = 0;
			} else {
				invoice.status = 'partial';
			}
		}

		/* ================================
		   5. DELETE PAYMENT
		================================ */

		await customer.save();
		if (invoice) await invoice.save();
		await payment.deleteOne();

		res.json({ message: 'Payment deleted successfully' });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
