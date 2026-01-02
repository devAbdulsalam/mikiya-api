import Transaction from '../models/Transaction.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Outlet from '../models/Outlet.js';


export const createTransaction = async (req, res) => {
	try {
		const session = await Transaction.startSession();
		session.startTransaction();

		try {
			const { outletId, customerId, items, payment, notes } = req.body;

			// Validate outlet
			const outlet = await Outlet.findById(outletId).session(session);
			if (!outlet) {
				throw new Error('Outlet not found');
			}

			// Validate customer
			const customer = await Customer.findById(customerId).session(session);
			if (!customer) {
				throw new Error('Customer not found');
			}

			// Process items and update stock
			const processedItems = [];
			for (const item of items) {
				const product = await Product.findById(item.productId).session(session);
				if (!product) {
					throw new Error(`Product ${item.productId} not found`);
				}

				// Find outlet stock
				const outletStock = product.outlets.find(
					(o) => o.outletId.toString() === outletId
				);

				if (!outletStock || outletStock.stock < item.quantity) {
					throw new Error(`Insufficient stock for ${product.name}`);
				}

				// Update stock
				outletStock.stock -= item.quantity;
				await product.save({ session });

				// Calculate item total
				const unitPrice =
					outletStock.price?.retail || product.pricing.sellingPrice;
				const itemTotal = unitPrice * item.quantity;

				processedItems.push({
					productId: product._id,
					sku: product.sku,
					name: product.name,
					quantity: item.quantity,
					unitPrice,
					total: itemTotal,
				});
			}

			// Calculate totals
			const subtotal = processedItems.reduce(
				(sum, item) => sum + item.total,
				0
			);
			const taxAmount = (subtotal * outlet.settings.taxRate) / 100;
			const totalAmount = subtotal + taxAmount;

			// Check credit limit if payment is credit
			if (payment.method === 'credit') {
				const newDebt =
					customer.creditInfo.currentDebt + (totalAmount - payment.amountPaid);
				if (
					customer.creditInfo.creditLimit > 0 &&
					newDebt > customer.creditInfo.creditLimit
				) {
					throw new Error('Credit limit exceeded');
				}
			}

			// Create transaction
			const transaction = new Transaction({
				outletId,
				customerId,
				items: processedItems,
				subtotal,
				tax: {
					amount: taxAmount,
					rate: outlet.settings.taxRate,
				},
				totalAmount,
				payment,
				notes,
				createdBy: req.user.id,
			});

			await transaction.save({ session });

			// Update customer stats and debt
			customer.salesStats.totalTransactions += 1;
			customer.salesStats.totalAmount += totalAmount;
			customer.salesStats.lastPurchase = new Date();
			customer.salesStats.averagePurchase =
				customer.salesStats.totalAmount / customer.salesStats.totalTransactions;

			if (payment.method === 'credit') {
				customer.creditInfo.currentDebt += totalAmount - payment.amountPaid;
			}

			await customer.save({ session });

			// Update outlet sales
			outlet.totalSales += totalAmount;
			outlet.financial.totalRevenue += totalAmount;
			await outlet.save({ session });

			await session.commitTransaction();

			res.status(201).json({
				success: true,
				message: 'Transaction completed successfully',
				transaction,
			});
		} catch (error) {
			await session.abortTransaction();
			throw error;
		} finally {
			session.endSession();
		}
	} catch (error) {
		res.status(500).json({
			success: false,
			message: 'Transaction failed',
			error: error.message,
		});
	}
};

export const getTransaction = async (req, res) => {
	try {
		const { outletId, customerId, startDate, endDate, type } = req.query;
		const filter = {};

		if (outletId) {
			filter.outletId = outletId;
		} else if (req.user.role !== 'admin' && req.user.outletId) {
			filter.outletId = req.user.outletId;
		}

		if (customerId) {
			filter.customerId = customerId;
		}

		if (type) {
			filter.type = type;
		}

		if (startDate && endDate) {
			filter.createdAt = {
				$gte: new Date(startDate),
				$lte: new Date(endDate),
			};
		}

		const transactions = await Transaction.find(filter)
			.populate('outletId', 'name')
			.populate('customerId', 'name customerId')
			.sort({ createdAt: -1 });

		res.json({
			success: true,
			count: transactions.length,
			transactions,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: 'Failed to fetch transactions',
			error: error.message,
		});
	}
};
