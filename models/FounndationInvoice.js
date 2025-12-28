import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
	invoiceId: {
		type: String,
		required: true,
		unique: true,
		trim: true,
	},
	foundationId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Foundation',
		required: true,
	},
	fundId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Fund',
		required: true,
	},

	// Invoice Details
	invoiceType: {
		type: String,
		enum: [
			'donation',
			'grant',
			'service',
			'membership',
			'event',
			'product',
			'other',
		],
		default: 'donation',
	},
	invoiceTo: {
		name: String,
		email: String,
		phone: String,
		address: String,
		taxId: String,
	},

	// Items
	items: [
		{
			description: {
				type: String,
				required: true,
			},
			quantity: {
				type: Number,
				required: true,
				min: 1,
			},
			unitPrice: {
				type: Number,
				required: true,
				min: 0,
			},
			total: {
				type: Number,
				required: true,
				min: 0,
			},
			taxRate: {
				type: Number,
				default: 0,
			},
			taxAmount: {
				type: Number,
				default: 0,
			},
		},
	],

	// Amounts
	subtotal: {
		type: Number,
		required: true,
		min: 0,
	},
	tax: {
		amount: {
			type: Number,
			default: 0,
		},
		rate: {
			type: Number,
			default: 0,
		},
	},
	discount: {
		amount: {
			type: Number,
			default: 0,
		},
		percentage: {
			type: Number,
			default: 0,
		},
	},
	totalAmount: {
		type: Number,
		required: true,
		min: 0,
	},
	currency: {
		type: String,
		default: 'NGN',
	},

	// Dates
	issueDate: {
		type: Date,
		required: true,
		default: Date.now,
	},
	dueDate: {
		type: Date,
		required: true,
	},
	paidDate: Date,

	// Payment Information
	payment: {
		method: {
			type: String,
			enum: ['bank_transfer', 'cheque', 'cash', 'online', 'mobile', 'other'],
			default: 'bank_transfer',
		},
		reference: String,
		status: {
			type: String,
			enum: ['pending', 'partial', 'paid', 'overdue', 'cancelled'],
			default: 'pending',
		},
		amountPaid: {
			type: Number,
			default: 0,
		},
		balance: {
			type: Number,
			default: function () {
				return this.totalAmount - (this.payment?.amountPaid || 0);
			},
		},
	},

	// Bank Details
	bankDetails: {
		bankName: String,
		accountName: String,
		accountNumber: String,
		sortCode: String,
		iban: String,
		swiftCode: String,
	},

	// Terms and Notes
	paymentTerms: String,
	notes: String,
	termsAndConditions: String,

	// Status
	status: {
		type: String,
		enum: [
			'draft',
			'sent',
			'viewed',
			'paid',
			'overdue',
			'cancelled',
			'refunded',
		],
		default: 'draft',
	},

	// Delivery
	deliveryMethod: {
		type: String,
		enum: ['email', 'post', 'hand_delivery', 'download'],
		default: 'email',
	},
	sentDate: Date,
	viewedDate: Date,

	// Reminders
	reminders: [
		{
			reminderDate: Date,
			method: String,
			sent: Boolean,
			sentDate: Date,
		},
	],

	// Audit Trail
	createdBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	approvedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	updatedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	attachments: [
		{
			name: String,
			url: String,
			uploadDate: Date,
		},
	],
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

// Update timestamp before saving
invoiceSchema.pre('save', async function () {
	this.updatedAt = Date.now();

	// Calculate totals
	let subtotal = 0;
	let totalTax = 0;

	this.items.forEach((item) => {
		item.total = item.quantity * item.unitPrice;
		item.taxAmount = item.total * (item.taxRate / 100);
		subtotal += item.total;
		totalTax += item.taxAmount;
	});

	this.subtotal = subtotal;
	this.tax.amount = totalTax;

	// Calculate discount
	if (this.discount.percentage > 0) {
		this.discount.amount = (this.subtotal * this.discount.percentage) / 100;
	}

	// Calculate total
	this.totalAmount = this.subtotal + this.tax.amount - this.discount.amount;

	// Calculate payment balance
	if (this.payment) {
		this.payment.balance = this.totalAmount - this.payment.amountPaid;

		// Update payment status
		if (this.payment.balance <= 0) {
			this.payment.status = 'paid';
			this.status = 'paid';
			this.paidDate = new Date();
		} else if (this.payment.amountPaid > 0) {
			this.payment.status = 'partial';
		} else if (new Date() > this.dueDate) {
			this.payment.status = 'overdue';
			this.status = 'overdue';
		}
	}

	next();
});

// Generate invoice ID before saving
invoiceSchema.pre('save', async function () {
	if (!this.invoiceId) {
		const year = new Date().getFullYear();
		const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
		const count = await this.constructor.countDocuments({
			foundationId: this.foundationId,
			createdAt: {
				$gte: new Date(new Date().getFullYear(), 0, 1),
				$lt: new Date(new Date().getFullYear() + 1, 0, 1),
			},
		});
		this.invoiceId = `INV-${this.foundationId
			.toString()
			.slice(-4)}-${year}${month}-${(count + 1).toString().padStart(4, '0')}`;
	}
});

const FoundationInvoice = mongoose.model('FoundationInvoice', invoiceSchema);

export default FoundationInvoice;
