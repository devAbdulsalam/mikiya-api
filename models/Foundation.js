import mongoose from 'mongoose';

const foundationSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		description: String,
		bankAccounts: [
			{
				bankName: String,
				accountName: String,
				accountNumber: String,
				accountType: String,
				currency: { type: String, default: 'NGN' },
				isPrimary: { type: Boolean, default: false },
				balance: { type: Number, default: 0 },
				lastReconciliation: Date,
			},
		],
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	},
	{ timestamps: true }
);

export default mongoose.model('Foundation', foundationSchema);
