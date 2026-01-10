import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema(
	{
		foundationId: { type: String, required: true },
		donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donor' },

		invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },

		amount: { type: Number, required: true },
		paymentMethod: {
			type: String,
			enum: ['bank_transfer', 'cash', 'card', 'mobile_money'],
		},

		reference: String,
		receivedDate: { type: Date, default: Date.now },
	},
	{ timestamps: true }
);

export default mongoose.model('Donation', donationSchema);
