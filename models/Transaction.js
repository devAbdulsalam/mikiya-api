import mongoose from 'mongoose';

const transactionItemSchema = new mongoose.Schema({
	productId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Product',
		required: true,
	},
	sku: String,
	name: String,
	quantity: {
		type: Number,
		required: true,
		min: 1,
	},
	unitPrice: {
		type: Number,
		required: true,
	},
	discount: {
		type: Number,
		default: 0,
	},
	total: {
		type: Number,
		required: true,
	},
});

const transactionSchema = new mongoose.Schema({
	transactionId: {
		type: String,
		required: true,
		unique: true,
	},
	invoiceNumber: String,
	outletId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Outlet',
		required: true,
	},
	customerId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Customer',
		required: true,
	},
	type: {
		type: String,
		enum: ['sale', 'return', 'credit_payment', 'expense'],
		default: 'sale',
	},
	items: [transactionItemSchema],
	subtotal: {
		type: Number,
		required: true,
	},
	tax: {
		amount: { type: Number, default: 0 },
		rate: { type: Number, default: 7.5 },
	},
	discount: {
		amount: { type: Number, default: 0 },
		percentage: { type: Number, default: 0 },
	},
	totalAmount: {
		type: Number,
		required: true,
	},
	payment: {
		method: {
			type: String,
			enum: ['cash', 'bank_transfer', 'pos', 'credit', 'cheque'],
			default: 'cash',
		},
		amountPaid: {
			type: Number,
			required: true,
		},
		balance: {
			type: Number,
			default: 0,
		},
		status: {
			type: String,
			enum: ['paid', 'partial', 'pending'],
			default: 'paid',
		},
	},
	status: {
		type: String,
		enum: ['completed', 'pending', 'cancelled', 'refunded'],
		default: 'completed',
	},
	notes: String,
	createdBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

// Generate transaction ID before saving
transactionSchema.pre('save', async function () {
	if (!this.transactionId) {
		const timestamp = Date.now();
		const random = Math.floor(Math.random() * 1000);
		this.transactionId = `TXN-${timestamp}-${random}`;
	}
});

// Calculate totals before saving
transactionSchema.pre('save', async function () {
	// Calculate subtotal from items
	this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);

	// Calculate tax
	this.tax.amount = (this.subtotal * this.tax.rate) / 100;

	// Calculate discount
	if (this.discount.percentage > 0) {
		this.discount.amount = (this.subtotal * this.discount.percentage) / 100;
	}

	// Calculate total
	this.totalAmount = this.subtotal + this.tax.amount - this.discount.amount;

	// Calculate balance
	this.payment.balance = this.totalAmount - this.payment.amountPaid;

	// Update payment status
	if (this.payment.balance <= 0) {
		this.payment.status = 'paid';
	} else if (this.payment.amountPaid > 0) {
		this.payment.status = 'partial';
	} else {
		this.payment.status = 'pending';
	}

});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;