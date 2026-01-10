import mongoose from 'mongoose';

const grantSchema = new mongoose.Schema(
	{
		foundationId: { type: String, required: true },
		grantorName: String,

		amount: { type: Number, required: true },
		purpose: String,

		startDate: Date,
		endDate: Date,

		status: {
			type: String,
			enum: ['approved', 'disbursed', 'closed'],
			default: 'approved',
		},
	},
	{ timestamps: true }
);

export default mongoose.model('Grant', grantSchema);
