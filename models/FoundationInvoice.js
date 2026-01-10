
import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
	{
		foundationId: { type: String, required: true, index: true },

		projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },

		category: {
			type: String,
			enum: [
				'Education',
				'Healthcare',
				'Infrastructure',
				'Operations',
				'Youth Empowerment',
				'Community',
				'Administrative',
				'Travel',
				'Equipment',
			],
		},

		description: String,
		amount: { type: Number, required: true },

		payee: String,

		status: {
			type: String,
			enum: ['pending', 'approved', 'paid'],
			default: 'pending',
		},

		expenseType: {
			type: String,
			enum: ['operational', 'project'],
			default: 'operational',
		},

		paymentMethod: {
			type: String,
			enum: ['bank_transfer', 'cash', 'cheque'],
		},

		reference: String,
		date: { type: Date, default: Date.now },
		notes: String,

		isDeleted: { type: Boolean, default: false },
		deletedAt: Date,
	},
	{ timestamps: true }
);

export default mongoose.model('Expense', expenseSchema);
