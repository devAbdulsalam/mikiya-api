
import mongoose from 'mongoose';

const FoundationInvoiceSchema = new mongoose.Schema(
	{
		foundationId: { type: String, required: true, index: true },

		projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },

		category: {
			type: String,
		},

		name: String,
		email: String,
		phone: String,
		invoiceNumber: String,
		address: String,

		description: String,
		amount: { type: Number, required: true },

		payee: String,

		status: {
			type: String,
			enum: ['pending', 'approved', 'overdue', 'paid'],
			default: 'pending',
		},

		type: {
			type: String,
			default: 'operational',
		},

		paymentMethod: {
			type: String,
			enum: ['bank_transfer', 'cash', 'cheque'],
		},

		reference: String,
		notes: String,
		date: { type: Date, default: Date.now },
		notes: String,

		isDeleted: { type: Boolean, default: false },
		deletedAt: Date,
	},
	{ timestamps: true }
);

export default mongoose.model('FoundationInvoice', FoundationInvoiceSchema);
