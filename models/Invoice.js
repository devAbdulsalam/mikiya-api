import mongoose, { Schema } from 'mongoose';

const invoiceSchema = new mongoose.Schema({
	invoiceNumber: {
		type: String,
		required: true,
		unique: true,
	},
	businessId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Business',
		required: true,
	},
	transactionId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Transaction',
	},
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
	issueDate: {
		type: Date,
		default: Date.now,
	},
	dueDate: Date,
	items: [
		{
			productId: mongoose.Types.ObjectId,
			title: String,
			price: Number,
			quantity: Number,
			subtotal: Number,
		},
	],
	subtotal: Number,
	tax: Number,
	discount: Number,
	total: Number,
	amountPaid: Number,
	balance: Number,
	paymentTerms: String,
	status: {
		type: String,
		enum: ['paid', 'partial', 'overdue', 'pending'],
		default: 'pending',
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

// Generate invoice number before saving
invoiceSchema.pre('save', async function () {
	if (!this.invoiceNumber) {
		const year = new Date().getFullYear();
		const count = await this.constructor.countDocuments();
		this.invoiceNumber = `INV-${year}-${(count + 1)
			.toString()
			.padStart(6, '0')}`;
	}

	// Set due date (default: 30 days from issue)
	if (!this.dueDate) {
		const dueDate = new Date(this.issueDate);
		dueDate.setDate(dueDate.getDate() + 30);
		this.dueDate = dueDate;
	}
});

const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;
